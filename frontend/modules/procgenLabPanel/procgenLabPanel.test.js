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
let PAGE_TO_HOST;
let moduleIndex;
let eventBus;
let atlasCache;
let levelSetCache;
let levelSetContentHash;
let heldLevelSetOf;

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
    ({ LAB_EVENTS, PAGE_TO_HOST } = await import('../procgenCore/labProtocol.js'));
    ({ atlasCache } = await import('../procgenCore/atlasCache.js'));
    ({ levelSetCache } = await import('../procgenCore/levelSetCache.js'));
    ({ levelSetContentHash, heldLevelSetOf } = await import('../procgenCore/levelSetReference.js'));
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

    it('⛓ publishes the host→page events plus the reverse link\'s two, and subscribes '
        + 'to the page→host ones plus iframe:appReady', () => {
        const api = recordingApi();
        moduleIndex.register(api);
        expect(api.seen.panels.map(([t]) => t)).toEqual(['procgenLabPanel']);
        /**
         * ⛔ Stated literally rather than mapped off HOST_TO_PAGE: a test that
         * read the same table the code reads would pass whatever that table said.
         *
         * ⛓⛓ H4c — the last two are NOT lab-protocol names. A page's reverse
         * link arrives here as `procgenLab:openInApworldEditor` and leaves as
         * the app's own pair; the bus DROPS an unregistered publisher with a
         * warn line and no throw, so the door would silently do nothing without
         * these two rows.
         */
        expect(api.seen.publishers.sort()).toEqual([
            'apworldEditor:loadRules',
            'procgenLab:load', 'procgenLab:navigate', 'procgenLab:requestState',
            'ui:activatePanel',
        ]);
        expect(api.seen.subscriberIntents.sort()).toEqual([
            'iframe:appReady', 'procgenLab:levelChanged',
            'procgenLab:openInApworldEditor', 'procgenLab:ready',
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
 * ⛓⛓⛓ H4c — THE REVERSE LINK, FORWARDED
 * ══════════════════════════════════════════════════════════════════════ */

describe('procgenLabPanel — a page\'s "open in the APWorld editor"', () => {
    /** ⛓ Watch the app-side pair the panel republishes onto. */
    const watchForward = () => {
        const seen = [];
        for (const name of ['apworldEditor:loadRules', 'ui:activatePanel']) {
            eventBus.subscribe(name, (d) => seen.push({ name, d }), 'test-observer');
        }
        return seen;
    };

    const RULES = Object.freeze({ game_name: 'Maze Library', regions: { 1: {} } });

    it('forwards the page\'s compiled document and then raises the hub — in that order',
        () => {
            const panel = mountPanel('maze');
            const seen = watchForward();
            publishAs(LAB_EVENTS.openInApworldEditor, {
                substrate: 'maze', iframeId: panel.iframeId,
                rules: RULES, source: 'the maze lab (SET arm)',
            }, `iframe_${panel.iframeId}`);
            expect(seen.map((s) => s.name))
                .toEqual(['apworldEditor:loadRules', 'ui:activatePanel']);
            // ⛓ VERBATIM: the panel forwards, it does not interpret.
            expect(seen[0].d.jsonData).toBe(RULES);
            expect(seen[0].d.source).toBe('the maze lab (SET arm)');
            expect(seen[1].d).toEqual({ panelId: 'apworldEditorPanel' });
            expect(byRole(panel.getRootElement(), 'note').textContent)
                .toMatch(/opened in the APWorld editor — the maze lab \(SET arm\)/);
        });

    /**
     * ⛔ THE ADDRESS IS THE WHOLE ROUTING CLAIM, one message later. Two lab
     * panels share one host bus, so a reverse link from the Seedling frame must
     * not open the maze frame's document — and this is the ONE page→host event
     * whose forward has a side effect outside the panel.
     */
    it('⛔ ignores a reverse link addressed to another frame', () => {
        const maze = mountPanel('maze');
        const seedling = mountPanel('seedling');
        const seen = watchForward();
        publishAs(LAB_EVENTS.openInApworldEditor, {
            substrate: 'seedling', iframeId: seedling.iframeId,
            rules: RULES, source: 'the Seedling watch page (SET arm)',
        }, `iframe_${seedling.iframeId}`);
        expect(seen).toHaveLength(2);
        expect(byRole(maze.getRootElement(), 'note').textContent ?? '')
            .not.toMatch(/APWorld/);
        expect(byRole(seedling.getRootElement(), 'note').textContent)
            .toMatch(/the Seedling watch page \(SET arm\)/);
    });

    /**
     * ⛓ THE PANEL VALIDATES WHAT IT FORWARDS. A malformed payload from a stale
     * page build is refused HERE, where the defect is visible, rather than
     * reaching the hub as a document with no story about where it came from.
     *
     * ⛔⛔ AND THE REFUSAL IS **PRINTED**, which is the half a throw would have
     * lost: `eventBus.publish` try/catches every subscriber and logs, so a
     * handler that let the validator throw would forward nothing AND say
     * nothing — a button that does not work and does not admit it. Measured:
     * the first shape of this row asserted `toThrow` and got `undefined`.
     */
    it('⛔ refuses a payload the protocol does not accept, and SAYS SO on the panel', () => {
        const panel = mountPanel('maze');
        const seen = watchForward();
        publishAs(LAB_EVENTS.openInApworldEditor, {
            substrate: 'maze', iframeId: panel.iframeId, rules: RULES, source: '',
        }, `iframe_${panel.iframeId}`);
        expect(seen).toEqual([]);
        const note = byRole(panel.getRootElement(), 'note');
        expect(note.textContent).toMatch(/non-empty string/);
        expect(note.className).toMatch(/bad/);
    });

    /* ── ⛓⛓ lab-apworld-door-map — the atlas the rules name, filed in the host atlasCache ── */

    const ATLAS = (id, regions = [{ region_id: 'r1' }]) => ({ atlas_id: id, regions });
    const RULES_NAMING = (...ids) => ({
        game_name: 'Lab Set', regions: { 1: {} },
        region_atlas: Object.fromEntries(ids.map((id, i) => [String(i + 1), { atlas_id: id, game: 'g' }])),
    });
    const handOver = (panel, rules, atlases) => publishAs(LAB_EVENTS.openInApworldEditor, {
        substrate: panel.substrate, iframeId: panel.iframeId,
        rules, source: 'the Seedling watch page (SET arm)', ...(atlases === undefined ? {} : { atlases }),
    }, `iframe_${panel.iframeId}`);
    /** What the cache held for `id` at the moment `apworldEditor:loadRules` went out. */
    const heldAtForward = (id) => {
        const at = [];
        eventBus.subscribe('apworldEditor:loadRules', () => at.push(atlasCache.get(id)), 'test-observer');
        return at;
    };

    /**
     * ⛓⛓ THE PUT PRECEDES THE FORWARD: the editor's Apply loads the rules, and the Region Map reads `hookCtxFor`
     * at load, so the atlas must already be cached when `apworldEditor:loadRules` is published. ⛔ MUTANT: move
     * `_fileAtlases` after the publish — `heldAtForward` reads `null` and reds. And a re-hand-over under the SAME
     * id replaces the cached one (put overwrites).
     */
    it('⛓⛓ puts the handed atlas in the host atlasCache BEFORE forwarding the rules; a re-hand-over replaces it', () => {
        atlasCache.clear();
        const panel = mountPanel('seedling');
        const at = heldAtForward('set-x');
        const v1 = ATLAS('set-x');
        const v2 = ATLAS('set-x', [{ region_id: 'r1' }, { region_id: 'r2' }]);
        handOver(panel, RULES_NAMING('set-x'), [v1]);
        handOver(panel, RULES_NAMING('set-x'), [v2]);
        expect(at).toEqual([v1, v2]);
        expect(atlasCache.get('set-x')).toBe(v2);
        expect(panel.lastAtlasHandover).toEqual({ put: ['set-x'], refused: [] });
        expect(byRole(panel.getRootElement(), 'note').textContent)
            .toMatch(/region atlas set-x filed for the Region Map$/);
        atlasCache.clear();
    });

    it('⛓ an absent `atlases` is `[]`: the rules are forwarded exactly as before and nothing is cached', () => {
        atlasCache.clear();
        const panel = mountPanel('seedling');
        const seen = watchForward();
        handOver(panel, RULES_NAMING('set-x'), undefined);
        expect(seen.map((s) => s.name)).toEqual(['apworldEditor:loadRules', 'ui:activatePanel']);
        expect(atlasCache.size).toBe(0);
        expect(panel.lastAtlasHandover).toEqual({ put: [], refused: [] });
    });

    /**
     * ⛔⛔ A REFUSED ATLAS IS NEVER PUT, IS NAMED, AND THE RULES STILL GO. Three refusals: an id no player of the
     * rules names (checked over EVERY player — player 2's id is accepted, an unnamed one is not), a document that
     * fails the bundle door's region-atlas shape test, and the good atlas already cached under that id is NOT
     * shadowed by a bad one. MUTANT: put everything offered — the mismatched id lands in the cache and reds.
     */
    it('⛔ refuses an id-mismatched or malformed atlas by name, never caches it, and still forwards the rules', () => {
        atlasCache.clear();
        const panel = mountPanel('seedling');
        const seen = watchForward();
        const good = ATLAS('p2-atlas');
        handOver(panel, RULES_NAMING('p1-atlas', 'p2-atlas'), [good]);
        expect(panel.lastAtlasHandover).toEqual({ put: ['p2-atlas'], refused: [] });
        const bad = { atlas_id: 'p2-atlas', regions: [{ name: 'no region_id' }] };
        handOver(panel, RULES_NAMING('p1-atlas', 'p2-atlas'), [ATLAS('somebody-else'), bad]);
        expect(panel.lastAtlasHandover.put).toEqual([]);
        expect(panel.lastAtlasHandover.refused.map((r) => r.atlas_id)).toEqual(['somebody-else', 'p2-atlas']);
        expect(panel.lastAtlasHandover.refused[0].why)
            .toMatch(/"somebody-else" is not the one the rules name \(region_atlas names "p1-atlas", "p2-atlas"\)/);
        expect(panel.lastAtlasHandover.refused[1].why).toMatch(/not a region atlas/);
        expect(atlasCache.has('somebody-else')).toBe(false);
        expect(atlasCache.get('p2-atlas')).toBe(good);
        expect(seen.filter((s) => s.name === 'apworldEditor:loadRules')).toHaveLength(2);
        const note = byRole(panel.getRootElement(), 'note');
        expect(note.textContent).toMatch(/⛔ region atlas REFUSED \(not cached\)/);
        expect(note.className).toMatch(/bad/);
        atlasCache.clear();
    });

    /**
     * ⛔ (cc-23's nit) A refusal sentence never throws: a structured-cloned payload can carry a CYCLIC object or a
     * BigInt, on which `JSON.stringify` throws — the hand-over must still refuse those atlases by name and forward.
     */
    it('⛔ a cyclic or BigInt atlas is refused by name, not thrown on, and the rules still go', () => {
        atlasCache.clear();
        const panel = mountPanel('seedling');
        const seen = watchForward();
        const cyclic = { regions: [] };
        cyclic.self = cyclic;
        handOver(panel, RULES_NAMING('set-x'), [cyclic, 10n, { atlas_id: 'set-x', regions: [{ region_id: 'r', n: 1n }] }]);
        expect(seen.map((s) => s.name)).toEqual(['apworldEditor:loadRules', 'ui:activatePanel']);
        expect(panel.lastAtlasHandover.refused.map((r) => r.why)).toEqual([
            'not a region atlas (the bundle door\'s test: atlas_id + regions[].region_id): an object with keys [regions, self]',
            'not a region atlas (the bundle door\'s test: atlas_id + regions[].region_id): bigint 10',
        ]);
        expect(panel.lastAtlasHandover.put).toEqual(['set-x']);
        atlasCache.clear();
    });

    it('⛔ a non-array `atlases` is the protocol\'s refusal: nothing forwarded, nothing cached, said on the panel', () => {
        atlasCache.clear();
        const panel = mountPanel('seedling');
        const seen = watchForward();
        handOver(panel, RULES_NAMING('set-x'), ATLAS('set-x'));
        expect(seen).toEqual([]);
        expect(atlasCache.size).toBe(0);
        expect(byRole(panel.getRootElement(), 'note').textContent).toMatch(/atlases must be an array/);
    });

    /* ── ⛓⛓ lab-apworld-door-play — the level set the rules name, held in the host levelSetCache ── */

    const SET = (id, tag = 'a') => ({ set_id: id, schema_version: 1, rooms: [{ id: 0, tag }, { id: 1, tag }] });
    const REF = (doc) => ({ set_id: doc.set_id, content_hash: levelSetContentHash(doc) });
    const RULES_WITH_SETS = (...refs) => ({
        game_name: 'Lab Set', regions: { 1: {} },
        region_atlas: Object.fromEntries(refs.map((ref, i) => [String(i + 1),
            { atlas_id: `atlas-${i + 1}`, game: 'g', ...(ref ? { level_set: ref } : {}) }])),
    });
    const handOverSets = (panel, rules, levelSets) => publishAs(LAB_EVENTS.openInApworldEditor, {
        substrate: panel.substrate, iframeId: panel.iframeId, rules, source: 'the Seedling watch page (SET arm)',
        atlases: [], ...(levelSets === undefined ? {} : { levelSets }),
    }, `iframe_${panel.iframeId}`);
    /** What the level-set cache answered for `ref` at the moment `apworldEditor:loadRules` went out. */
    const setAtForward = (ref) => {
        const at = [];
        eventBus.subscribe('apworldEditor:loadRules', () => at.push(levelSetCache.get(ref.set_id, ref.content_hash)), 'test-observer');
        return at;
    };

    /**
     * ⛓⛓ VALIDATE → PUT → FORWARD. The Flash panel's load after Apply asks `heldLevelSetOf(rules)`, so the set must
     * already be HELD under the rules' hash when `apworldEditor:loadRules` is published. MUTANT: move `_fileLevelSets`
     * after the publish — `setAtForward` reads `absent` and reds.
     */
    it('⛓⛓ holds the handed level set under the rules\' content hash BEFORE forwarding the rules', () => {
        levelSetCache.clear();
        const panel = mountPanel('seedling');
        const doc = SET('set-a');
        const ref = REF(doc);
        const at = setAtForward(ref);
        const seen = watchForward();
        handOverSets(panel, RULES_WITH_SETS(ref), [doc]);
        expect(at.map((g) => g.status)).toEqual(['held']);
        expect(at[0].set).toBe(doc);
        expect(seen.map((s) => s.name)).toEqual(['apworldEditor:loadRules', 'ui:activatePanel']);
        expect(panel.lastLevelSetHandover).toEqual({ put: [ref], refused: [], uncarried: [], evicted: [] });
        const note = byRole(panel.getRootElement(), 'note');
        expect(note.textContent).toMatch(/level set set-a held for the player$/);
        expect(note.className).not.toMatch(/bad/);
        levelSetCache.clear();
    });

    it('⛓ an absent `levelSets` is `[]`: the rules go over as before, nothing is held, the player is named uncarried', () => {
        levelSetCache.clear();
        const panel = mountPanel('seedling');
        const seen = watchForward();
        const ref = REF(SET('set-a'));
        handOverSets(panel, RULES_WITH_SETS(ref), undefined);
        expect(seen.map((s) => s.name)).toEqual(['apworldEditor:loadRules', 'ui:activatePanel']);
        expect(levelSetCache.size).toBe(0);
        expect(panel.lastLevelSetHandover).toEqual({ put: [], refused: [], uncarried: [{ player: '1', ...ref }], evicted: [] });
    });

    /**
     * ⛔⛔ (J1) THE HOST COMPUTES THE HASH. A document whose `provenance.content_hash` is the rules' hash but whose rooms
     * were edited, and one under another `set_id`: both REFUSED by name, never put, and the good set ALREADY held under
     * that id is not shadowed; the rules still go. MUTANT: `putLevelSets(data.levelSets)` (no verdict) — the edited
     * body replaces the held one and `get(...)` answers `mismatch`, red.
     */
    it('⛔ (J1) refuses an edited body that claims the rules\' hash, and a wrong set_id; never puts; no shadowing', () => {
        levelSetCache.clear();
        const panel = mountPanel('seedling');
        const seen = watchForward();
        const good = SET('set-a');
        const ref = REF(good);
        handOverSets(panel, RULES_WITH_SETS(ref), [good]);
        const lying = { ...structuredClone(good), provenance: { content_hash: ref.content_hash } };
        lying.rooms[0].tag = 'edited after the stamp';
        handOverSets(panel, RULES_WITH_SETS(ref), [lying, SET('set-b')]);
        expect(panel.lastLevelSetHandover.put).toEqual([]);
        expect(panel.lastLevelSetHandover.refused.map((r) => r.set_id)).toEqual(['set-a', 'set-b']);
        expect(panel.lastLevelSetHandover.refused[0].why).toMatch(/hashes to [0-9a-f]{8}, not the content hash the rules name/);
        expect(panel.lastLevelSetHandover.refused[1].why).toMatch(/"set-b" is not one the rules name/);
        expect(panel.lastLevelSetHandover.uncarried).toEqual([{ player: '1', ...ref }]);
        expect(levelSetCache.get(ref.set_id, ref.content_hash).set).toBe(good);
        expect(levelSetCache.has('set-b')).toBe(false);
        expect(seen.filter((s) => s.name === 'apworldEditor:loadRules')).toHaveLength(2);
        const note = byRole(panel.getRootElement(), 'note');
        expect(note.textContent).toMatch(/⛔ level set REFUSED \(not held\)/);
        expect(note.className).toMatch(/bad/);
        levelSetCache.clear();
    });

    /**
     * ⛓ (J3) MULTI-PLAYER, EACH ON ITS OWN. (i) Player 1 names A, player 2 names B; a good A and a tampered B are
     * carried while a good B is ALREADY held: A is put, the tampered B is refused, the held B is untouched.
     * (ii) Both players name `set-s` under two hashes: player 1's good version alone is put, player 2 is uncarried;
     * with good documents for BOTH, neither is put (one set per id) and the earlier held one stays.
     */
    it('⛓ (J3) two players: a mismatch for one never puts or shadows the other\'s', () => {
        levelSetCache.clear();
        const panel = mountPanel('seedling');
        const a = SET('set-a');
        const b = SET('set-b');
        levelSetCache.put('set-b', b, { contentHash: REF(b).content_hash });
        const tamperedB = SET('set-b', 'tampered');
        handOverSets(panel, RULES_WITH_SETS(REF(a), REF(b)), [a, tamperedB]);
        expect(panel.lastLevelSetHandover.put).toEqual([REF(a)]);
        expect(panel.lastLevelSetHandover.refused.map((r) => r.set_id)).toEqual(['set-b']);
        expect(levelSetCache.get('set-a', REF(a).content_hash).set).toBe(a);
        expect(levelSetCache.get('set-b', REF(b).content_hash).set).toBe(b);

        levelSetCache.clear();
        const s1 = SET('set-s', 'one');
        const s2 = SET('set-s', 'two');
        const rules = RULES_WITH_SETS(REF(s1), REF(s2));
        handOverSets(panel, rules, [s1]);
        expect(panel.lastLevelSetHandover.put).toEqual([REF(s1)]);
        expect(panel.lastLevelSetHandover.uncarried).toEqual([{ player: '2', ...REF(s2) }]);
        handOverSets(panel, rules, [s2, s1]);
        expect(panel.lastLevelSetHandover.put).toEqual([]);
        expect(panel.lastLevelSetHandover.refused).toHaveLength(2);
        expect(levelSetCache.get('set-s', REF(s1).content_hash).set).toBe(s1);
        levelSetCache.clear();
    });

    /**
     * ⛓ (J2) MEASURED, AND PINNED AS IT STANDS (⚖ js-22, J2 = (A) accepted: "the app holds 4 sets; a 5th, from either
     * door, drops the oldest, and that set must be re-opened"). The cache holds `LEVEL_SET_CACHE_LIMIT` (4) sets, FIFO
     * by last put. A door-A put of a 5th id evicts the one put longest ago — whatever door put it, including the set a
     * RUNNING game was loaded from (`held-1` here: the bundle's) — and the panel says which. What that set's two
     * readers then answer, by name: Edit ▸'s `levelSetCache.get(set_id, hash)` (`flashPanelUI._editHeldSetRoom`) and a
     * re-load's `heldLevelSetOf(rules)` (`flashPanelUI._customSetRefusal` → G, and the wiring). Neither serves a body.
     * ⛔ A change to the cache's bound or eviction rule (js-22's backlog: live-set pinning) reds this row ON PURPOSE.
     */
    it('⛓ (J2) a good put into a FULL cache evicts the oldest put, and the panel names it', () => {
        levelSetCache.clear();
        const panel = mountPanel('seedling');
        for (const id of ['held-1', 'held-2', 'held-3', 'held-4']) {
            const d = SET(id);
            levelSetCache.put(id, d, { contentHash: REF(d).content_hash });
        }
        const runningRef = REF(SET('held-1'));
        expect(levelSetCache.limit).toBe(4);
        const doc = SET('door-a');
        handOverSets(panel, RULES_WITH_SETS(REF(doc)), [doc]);
        expect(panel.lastLevelSetHandover.evicted).toEqual(['held-1']);
        const editReads = levelSetCache.get(runningRef.set_id, runningRef.content_hash);
        expect(editReads).toMatchObject({ status: 'absent', set: null, why: 'no level set with set_id "held-1" is held' });
        const reloadReads = heldLevelSetOf(RULES_WITH_SETS(runningRef), '1', levelSetCache);
        expect(reloadReads).toMatchObject({ status: 'absent', set: null, why: 'no level set with set_id "held-1" is held' });
        expect(levelSetCache.ids()).toEqual(['held-2', 'held-3', 'held-4', 'door-a']);
        expect(byRole(panel.getRootElement(), 'note').textContent).toMatch(/let go of held-1\)$/);
        // the SAME set handed again moves it to the newest end and evicts nothing
        handOverSets(panel, RULES_WITH_SETS(REF(doc)), [doc]);
        expect(panel.lastLevelSetHandover.evicted).toEqual([]);
        levelSetCache.clear();
    });

    it('⛔ a non-array `levelSets` is the protocol\'s refusal: nothing forwarded, nothing held, said on the panel', () => {
        levelSetCache.clear();
        const panel = mountPanel('seedling');
        const seen = watchForward();
        const doc = SET('set-a');
        handOverSets(panel, RULES_WITH_SETS(REF(doc)), doc);
        expect(seen).toEqual([]);
        expect(levelSetCache.size).toBe(0);
        expect(byRole(panel.getRootElement(), 'note').textContent).toMatch(/levelSets must be an array/);
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
        /**
         * ⛓ DERIVED, not typed: every PAGE→HOST name plus `iframe:appReady`.
         * H4c added an eighth protocol name and this count moved with it —
         * a typed number here would have reported that as a defect
         * ([[feedback_count_in_a_test_name_is_an_allowlist_key]]'s family).
         */
        expect(panel._unsubs.length).toBe(PAGE_TO_HOST.length + 1);
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
