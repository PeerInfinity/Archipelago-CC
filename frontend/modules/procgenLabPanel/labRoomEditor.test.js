/**
 * labRoomEditor — the host side of the ROOM-EDITOR CONTRACT for `kind: 'lab'`.
 *
 * EDITOR INTEGRATION arc, slice W3. What the rows below are ABOUT:
 *
 *  · the door REFUSES rather than hanging, in every way it can fail before the
 *    document is in the page (an unknown page, no panel mounted, a payload the
 *    panel throws on);
 *  · the OUT path is the envelope's `room` TRANSITION `n → null` and nothing
 *    else — not a count of edits (trap 599's family), not the first
 *    `levelChanged` after the load;
 *  · `onSave` fires EXACTLY ONCE and the subscription is gone afterwards;
 *  · this module imports nothing from a substrate.
 *
 * ⛓ The bus is the REAL one (it loads headless), so what these rows exercise is
 * the routing the app actually runs. The PANEL is a stand-in, because a real
 * one wants an iframe.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let eventBus;
let mod;
let envelopeMod;

const IFRAME_ID = 'procgenLab-maze-1';

beforeEach(async () => {
    vi.resetModules();
    ({ default: eventBus } = await import('../../app/core/eventBus.js'));
    mod = await import('./labRoomEditor.js');
    envelopeMod = await import('../procgenCore/labRoomEnvelope.js');
    /**
     * ⛓⛓ EDITOR INTEGRATION W4 — **THE APP REGISTERS ITS BUS, AND THESE ROWS
     * STAND IN FOR THE APP.** `labRoomEditor.js` no longer IMPORTS
     * `app/core/eventBus.js` (importing it printed `[centralRegistry]
     * CentralRegistry initialized`, which `lab.html` must not pay for); the
     * panel registers it at its own import instead. ⛔ Registered HERE rather
     * than passing `bus` to every call, because what these rows exercise is
     * the DEFAULT path — the one `regionEditors`' binding uses.
     */
    mod.registerAppEventBus(eventBus);
    mod.clearLabPanelInstances();
    // ⛓ The adapter registers `iframe_<id>` dynamically at publish time in the
    //   app; a test that skipped this would watch the bus DROP its own fixture
    //   (`eventBus.js:126`, warn + return) and call it a routing result.
    eventBus.registerPublisher('procgenLab:levelChanged', 'testFrame');
});

afterEach(() => {
    mod.clearLabPanelInstances();
});

/** A `ProcgenLabPanelUI` stand-in that records the two verbs. */
function fakePanel({ substrate = 'maze', iframeId = IFRAME_ID, onNavigate = null } = {}) {
    return {
        substrate,
        iframeId,
        loads: [],
        navigates: [],
        raised: 0,
        notes: [],
        load(record) { this.loads.push(record); return true; },
        navigate(search) {
            if (onNavigate) onNavigate(search);
            this.navigates.push(search);
            return true;
        },
        raise() { this.raised += 1; return true; },
        _note(text, bad) { this.notes.push({ text, bad }); },
    };
}

const announce = (payload, iframeId = IFRAME_ID, substrate = 'maze') => {
    eventBus.publish('procgenLab:levelChanged', { substrate, iframeId, payload }, 'testFrame');
};

const envelope = (room, record) => envelopeMod.makeSetRecordEnvelope({
    substrate: 'maze', room, record,
});

const LIBRARY = { library: { library_id: 'demo', entries: [{}, {}, {}] }, overlay: {} };

/* ══════════════════════════════════════════════════════════════════════
 * THE REFUSALS — none of them throws, none of them hangs
 * ══════════════════════════════════════════════════════════════════════ */

describe('labRoomEditor — it refuses by name and never throws', () => {
    it('refuses a page that is not a lab page', () => {
        const r = mod.openLabRoomEditor({
            page: 'bounce', arm: 'set', room: 0, record: LIBRARY, onSave: () => {},
        });
        expect(r.ok).toBe(false);
        expect(r.why).toContain('bounce');
        expect(r.why).toContain('maze');
    });

    it('refuses a missing arm — the words `set`/`edit` come off the registry entry', () => {
        mod.registerLabPanelInstance(fakePanel());
        const r = mod.openLabRoomEditor({
            page: 'maze', room: 0, record: LIBRARY, onSave: () => {},
        });
        expect(r.ok).toBe(false);
        expect(r.why).toContain('arm');
    });

    it('refuses a fractional or negative room index', () => {
        mod.registerLabPanelInstance(fakePanel());
        for (const room of [-1, 1.5, '2', null]) {
            const r = mod.openLabRoomEditor({
                page: 'maze', arm: 'set', room, record: LIBRARY, onSave: () => {},
            });
            expect(r.ok).toBe(false);
            expect(r.why).toContain('room');
        }
    });

    it('refuses a record that is not a document, naming the `panel` kind', () => {
        mod.registerLabPanelInstance(fakePanel());
        const r = mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 0, record: null, onSave: () => {},
        });
        expect(r.ok).toBe(false);
        expect(r.why).toContain('panel');
    });

    it('refuses a missing onSave — it is the ONLY return path', () => {
        mod.registerLabPanelInstance(fakePanel());
        const r = mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 0, record: LIBRARY,
        });
        expect(r.ok).toBe(false);
        expect(r.why).toContain('onSave');
    });

    it('⛓ refuses when no lab panel for that page is mounted — and says which to open', () => {
        mod.registerLabPanelInstance(fakePanel({ substrate: 'seedling' }));
        const r = mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 0, record: LIBRARY, onSave: () => {},
        });
        expect(r.ok).toBe(false);
        expect(r.why).toContain('Procgen Lab');
        expect(r.why).toContain('maze');
    });

    it('⛔ a panel whose `load` THROWS is a refusal in the same call, not a hang', () => {
        const panel = fakePanel();
        panel.load = () => { throw new Error('that is not a payload object'); };
        mod.registerLabPanelInstance(panel);
        const r = mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 0, record: LIBRARY, onSave: () => {},
        });
        expect(r.ok).toBe(false);
        expect(r.why).toContain('not a payload object');
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE ROUND TRIP
 * ══════════════════════════════════════════════════════════════════════ */

describe('labRoomEditor — document in, ONE room, folded document out', () => {
    it('⛓⛓⛓ loads the document, navigates to the room, and calls onSave ONCE on the '
        + 'room → null transition', () => {
        const panel = fakePanel();
        mod.registerLabPanelInstance(panel);
        const saved = [];
        const handle = mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 1, record: LIBRARY, onSave: (r) => saved.push(r),
        });
        expect(handle.ok).toBe(true);
        // 1. THE DOCUMENT IN — verbatim, through the panel's own `load`.
        expect(panel.loads).toEqual([LIBRARY]);
        expect(panel.raised).toBe(1);
        // …and NOTHING has been navigated yet: the page has not said it holds it.
        expect(panel.navigates).toEqual([]);

        // 2. The page reports it is holding a SET document with no room open.
        announce(envelope(null, LIBRARY));
        expect(panel.navigates).toEqual(['?source=set&room=1']);
        expect(saved).toEqual([]);

        // 3. The room opens…
        announce(envelope(1, LIBRARY));
        expect(saved).toEqual([]);

        // 4. …and closes, with the folded document.
        const edited = { library: { library_id: 'demo', entries: [{}, { edited: true }, {}] },
            overlay: {} };
        announce(envelope(null, edited));
        expect(saved).toEqual([edited]);
    });

    it('⛔ a SECOND levelChanged after the close does NOT call onSave twice', () => {
        const panel = fakePanel();
        mod.registerLabPanelInstance(panel);
        const saved = [];
        mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 1, record: LIBRARY, onSave: (r) => saved.push(r),
        });
        announce(envelope(null, LIBRARY));
        announce(envelope(1, LIBRARY));
        announce(envelope(null, { closed: 'once' }));
        announce(envelope(null, { closed: 'twice' }));
        announce(envelope(2, LIBRARY));
        announce(envelope(null, { closed: 'thrice' }));
        expect(saved).toEqual([{ closed: 'once' }]);
    });

    it('⛔ the LADDER payload is not a close — a page that never reaches the SET arm '
        + 'never navigates and never saves', () => {
        const panel = fakePanel();
        mod.registerLabPanelInstance(panel);
        const saved = [];
        mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 0, record: LIBRARY, onSave: (r) => saved.push(r),
        });
        announce({ seed: 5, level: { tiles: [] } });
        announce({ seed: 6, level: { tiles: [] } });
        expect(panel.navigates).toEqual([]);
        expect(saved).toEqual([]);
    });

    it('⛔ an envelope addressed to ANOTHER frame is ignored — two labs, one bus', () => {
        const panel = fakePanel();
        mod.registerLabPanelInstance(panel);
        const saved = [];
        mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 1, record: LIBRARY, onSave: (r) => saved.push(r),
        });
        announce(envelope(null, LIBRARY), 'procgenLab-maze-2');
        expect(panel.navigates).toEqual([]);
        announce(envelope(null, LIBRARY));
        announce(envelope(1, LIBRARY));
        announce(envelope(null, { mine: true }), 'procgenLab-maze-2');
        expect(saved).toEqual([]);
        announce(envelope(null, { mine: true }));
        expect(saved).toEqual([{ mine: true }]);
    });

    it('⛓ the navigate is sent ONCE — a navigate per announce would re-open the room '
        + 'the reader just closed', () => {
        const panel = fakePanel();
        mod.registerLabPanelInstance(panel);
        mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 2, record: LIBRARY, onSave: () => {},
        });
        announce(envelope(null, LIBRARY));
        announce(envelope(null, LIBRARY));
        announce(envelope(null, LIBRARY));
        expect(panel.navigates).toEqual(['?source=set&room=2']);
    });

    it('⛔ a navigate the page REFUSES surfaces in the panel\'s note and stops the wait', () => {
        const panel = fakePanel({
            onNavigate: () => { throw new Error('?room= — nothing is held'); },
        });
        mod.registerLabPanelInstance(panel);
        const saved = [];
        mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 1, record: LIBRARY, onSave: (r) => saved.push(r),
        });
        announce(envelope(null, LIBRARY));
        expect(panel.notes[0].bad).toBe(true);
        expect(panel.notes[0].text).toContain('nothing is held');
        // …and the subscription is gone: a later close reaches nobody.
        announce(envelope(1, LIBRARY));
        announce(envelope(null, LIBRARY));
        expect(saved).toEqual([]);
    });

    it('⛓ `close()` gives up on the room and onSave never fires', () => {
        const panel = fakePanel();
        mod.registerLabPanelInstance(panel);
        const saved = [];
        const handle = mod.openLabRoomEditor({
            page: 'maze', arm: 'set', room: 1, record: LIBRARY, onSave: (r) => saved.push(r),
        });
        announce(envelope(null, LIBRARY));
        announce(envelope(1, LIBRARY));
        handle.close();
        announce(envelope(null, { late: true }));
        expect(saved).toEqual([]);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE INSTANCE REGISTRY, AND THE BINDING
 * ══════════════════════════════════════════════════════════════════════ */

describe('labRoomEditor — the panel registry and the binding', () => {
    it('finds a mounted panel by its substrate and forgets it on unregister', () => {
        const maze = fakePanel({ substrate: 'maze' });
        const seed = fakePanel({ substrate: 'seedling', iframeId: 'procgenLab-seedling-2' });
        mod.registerLabPanelInstance(maze);
        mod.registerLabPanelInstance(seed);
        expect(mod.findLabPanel('maze')).toBe(maze);
        expect(mod.findLabPanel('seedling')).toBe(seed);
        expect(mod.labPanelInstances()).toEqual([maze, seed]);
        mod.unregisterLabPanelInstance(maze);
        expect(mod.findLabPanel('maze')).toBe(null);
        // ⛔ Idempotent: `destroy()` may run twice on a torn-down layout.
        mod.unregisterLabPanelInstance(maze);
        expect(mod.labPanelInstances()).toEqual([seed]);
    });

    it('⛓ `bindLabRoomEditor` carries the page AND the arm — the two labs differ in '
        + 'BOTH', () => {
        const maze = fakePanel({ substrate: 'maze' });
        const seed = fakePanel({ substrate: 'seedling', iframeId: 'procgenLab-seedling-2' });
        mod.registerLabPanelInstance(maze);
        mod.registerLabPanelInstance(seed);
        const openMaze = mod.bindLabRoomEditor({ page: 'maze', arm: 'set' });
        const openSeed = mod.bindLabRoomEditor({ page: 'seedling', arm: 'edit' });
        expect(openMaze({ room: 0, record: LIBRARY, onSave: () => {} }).ok).toBe(true);
        expect(openSeed({ room: 3, record: LIBRARY, onSave: () => {} }).ok).toBe(true);
        expect(maze.loads.length).toBe(1);
        expect(seed.loads.length).toBe(1);
        announce(envelope(null, LIBRARY));
        announce(envelopeMod.makeSetRecordEnvelope({
            substrate: 'seedling', room: null, record: LIBRARY,
        }), 'procgenLab-seedling-2', 'seedling');
        expect(maze.navigates).toEqual(['?source=set&room=0']);
        expect(seed.navigates).toEqual(['?source=edit&room=3']);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE IMPORT LIST
 * ══════════════════════════════════════════════════════════════════════ */

describe('labRoomEditor — what it is allowed to know', () => {
    it('⛔ imports NOTHING from a substrate — `procgenCore/` and the app bus only', () => {
        const src = readFileSync(
            fileURLToPath(new URL('./labRoomEditor.js', import.meta.url)), 'utf8');
        const specs = [...src.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
        /**
         * ⛓ EDITOR INTEGRATION W4 — **`shared/communicationProtocol.js` JOINED
         * THE LIST, AND IT IS NOT A SUBSTRATE.** `createPageLabTransport` speaks
         * the wire format `AdapterClient` speaks, and minting its own message
         * names would be a second spelling of a handshake the client alone
         * decides. `shared/` is the submodule every side of the app reads; the
         * claim this row makes — no substrate, ever — is untouched, and the
         * loop below is what actually makes it.
         */
        /**
         * ⛓⛓⛓ EDITOR INTEGRATION W4 — **AND THE APP EDGE IS GONE, WHICH IS A
         * STRICTER CLAIM THAN THE ONE THIS ROW STARTED WITH.** This module
         * imported `app/core/eventBus.js` for ONE thing (the default `bus`), and
         * W4 measured what that costs a page that is not the app: importing this
         * file printed `[centralRegistry] CentralRegistry initialized`. `lab.html`
         * is a standalone static page and now has a reason to import the
         * contract. The APP registers its bus at `procgenLabPanelUI`'s import,
         * the same inversion the instance registry already uses.
         * ⛓ `shared/communicationProtocol.js` joined for `createPageLabTransport`,
         * which speaks the wire format `AdapterClient` speaks — `shared/` is the
         * submodule every side reads and is not a substrate. The claim the loop
         * below makes — no substrate, ever — is untouched.
         */
        expect(specs).toEqual([
            '../procgenCore/labProtocol.js',
            '../procgenCore/labRoomEnvelope.js',
            '../shared/communicationProtocol.js',
        ]);
        expect(specs.some((sp) => sp.includes('app/'))).toBe(false);
        /**
         * ⛔ THE SCAN IS OVER THE SPECIFIERS, NOT THE FILE. The docblock NAMES
         * `mazeRoom/` and `seedlingDemo/` on purpose — saying which two
         * directories this module may not import is the whole point of the
         * sentence — and a substring scan over the source would redden on the
         * documentation of the rule it is checking.
         */
        for (const dir of ['mazeRoom', 'seedlingDemo', 'bounceDemo', 'flashPanel',
            'bounceRegionEditor', 'runnerDemo', 'procgenPipeline']) {
            expect(specs.some((s) => s.includes(`${dir}/`))).toBe(false);
        }
        // ⛓ …and there is no DYNAMIC one either — the same rule, the other spelling.
        expect(src).not.toMatch(/\bimport\s*\(/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR INTEGRATION W4 — THE PAGE TRANSPORT (§9.6 #1)
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⛔ **DRIVEN AGAINST STUBS, BECAUSE THE CLAIM IS THE WIRE PROTOCOL.** What
 * `createPageLabTransport` has to get right is the FOUR messages an
 * `AdapterClient` waits for and the ORDER they matter in — a claim about
 * `postMessage` frames, not about a browser. The child's own half is
 * `shared/adapterClient.js` and is not re-implemented here.
 */
const stubWorld = () => {
    const posted = [];
    const listeners = [];
    const iframe = {
        dataset: {},
        src: '',
        contentWindow: { postMessage: (m) => posted.push(m) },
        remove() { iframe.removed = true; },
        removed: false,
    };
    const doc = { createElement: () => iframe };
    const mount = { appendChild: (n) => { mount.child = n; } };
    const win = {
        location: { origin: 'http://localhost:8126' },
        addEventListener: (type, handler) => listeners.push({ type, handler }),
    };
    const deliver = (message) => listeners.filter((l) => l.type === 'message')
        .forEach((l) => l.handler({ data: message }));
    return { posted, iframe, doc, mount, win, deliver };
};

describe('⛓⛓⛓ createPageLabTransport — a HOST that is a page', () => {
    it('answers the four wire messages, and QUEUES until the flush point', async () => {
        const w = stubWorld();
        const protocol = await import('../shared/communicationProtocol.js');
        const { MessageTypes, createMessage } = protocol;
        const t = mod.createPageLabTransport({
            page: 'seedling',
            src: '/frontend/modules/seedlingDemo/watch.html?source=edit',
            mount: w.mount,
            win: w.win,
            doc: w.doc,
        });
        /**
         * ⛔ **THE ADDRESS IS SET BEFORE THE FRAME IS IN THE DOM**, and both
         * halves of it are load-bearing: `?iframeId=` is what the child checks
         * before it installs its bridge AT ALL (no parameter, no bridge, and
         * the page is a perfectly working standalone document that never
         * answers), and `&hostOrigin=` is what lets it target its sends at us
         * instead of falling back to `'*'`.
         */
        expect(w.mount.child).toBe(w.iframe);
        expect(w.iframe.src).toMatch(/watch\.html\?source=edit&iframeId=/);
        expect(w.iframe.src).toContain(`hostOrigin=${encodeURIComponent('http://localhost:8126')}`);
        expect(t.iframeId).toBe(w.iframe.dataset.iframeId);
        expect(t.ready()).toBe(false);

        /** ⛓ 1. `IFRAME_READY` → `ADAPTER_READY`, which RESOLVES the child's
         *  `connect()`. Without it the client retries for 10 s and rejects. */
        w.deliver(createMessage(MessageTypes.IFRAME_READY, t.iframeId, {}));
        expect(w.posted.map((m) => m.type)).toEqual([MessageTypes.ADAPTER_READY]);

        /**
         * ⛔⛔ 2. A `load` BEFORE the flush point is QUEUED, not sent. The
         * `eventBus` an iframe adapter fronts has NO REPLAY and publishes to
         * nobody when nothing is subscribed — so a document sent before
         * `IFRAME_APP_READY` is not merely late, it is GONE
         * ([[feedback_iframe_adapter_gotchas]]).
         */
        /** ⛓ `load` takes the DOCUMENT and ADDRESSES it, exactly as the panel's
         *  own does — the address is the transport's, never the caller's. */
        expect(t.load({ rooms: [] })).toBe(false);
        expect(w.posted).toHaveLength(1);

        /** ⛓ 3. `IFRAME_APP_READY` is the flush point. */
        w.deliver(createMessage(MessageTypes.IFRAME_APP_READY, t.iframeId, {}));
        expect(t.ready()).toBe(true);
        const flushed = w.posted[w.posted.length - 1];
        expect(flushed.type).toBe(MessageTypes.EVENT_BUS_MESSAGE);
        expect(flushed.data.eventName).toBe('procgenLab:load');
        expect(flushed.data.eventData).toEqual({
            substrate: 'seedling', iframeId: t.iframeId, payload: { rooms: [] },
        });
        // …and after it, a send goes straight out
        expect(t.navigate('?source=edit&room=2')).toBe(true);
        expect(w.posted[w.posted.length - 1].data.eventName).toBe('procgenLab:navigate');
        expect(w.posted[w.posted.length - 1].data.eventData.search).toBe('?source=edit&room=2');

        /** ⛓ 4. Everything the page SAYS reaches the page-local bus. */
        const heard = [];
        t.bus.subscribe('procgenLab:levelChanged', (d) => heard.push(d));
        w.deliver(createMessage(MessageTypes.PUBLISH_EVENT_BUS, t.iframeId, {
            eventName: 'procgenLab:levelChanged', eventData: { room: 2 },
        }));
        expect(heard).toEqual([{ room: 2 }]);
    });

    it('IGNORES a message addressed to a different frame, and DISPOSE stops it', async () => {
        const w = stubWorld();
        const { MessageTypes, createMessage } = await import('../shared/communicationProtocol.js');
        const t = mod.createPageLabTransport({
            page: 'seedling', src: '/x.html', mount: w.mount, win: w.win, doc: w.doc,
        });
        /**
         * ⛔ **THE ROUTING PREDICATE IS THE CLIENT ID**, exactly as
         * `labProtocol.addressedTo` is one layer up: a page may host more than
         * one frame over its life, and a transport that answered another
         * frame's `IFRAME_READY` would hand it OUR document.
         */
        w.deliver(createMessage(MessageTypes.IFRAME_READY, 'somebody-elses-frame', {}));
        expect(w.posted).toEqual([]);
        w.deliver(createMessage(MessageTypes.IFRAME_READY, t.iframeId, {}));
        expect(w.posted).toHaveLength(1);
        // ⛓ …and a disposed transport posts nothing more and takes its frame with it
        t.dispose();
        expect(w.iframe.removed).toBe(true);
        w.deliver(createMessage(MessageTypes.IFRAME_READY, t.iframeId, {}));
        expect(w.posted).toHaveLength(1);
    });

    it('`onEvent` fires at the FLUSH POINT — the fact a host readout needs', async () => {
        const w = stubWorld();
        const { MessageTypes, createMessage } = await import('../shared/communicationProtocol.js');
        const seen = [];
        const t = mod.createPageLabTransport({
            page: 'maze', src: '/x.html', mount: w.mount, win: w.win, doc: w.doc,
            onEvent: (what) => seen.push(what),
        });
        w.deliver(createMessage(MessageTypes.IFRAME_READY, t.iframeId, {}));
        /**
         * ⛔ NOTHING YET: `IFRAME_READY` says the frame's SCRIPT is up, and
         * `ready` — the flush point — is what separates that from *"the
         * document is in it"*. A host that repainted on the first is showing a
         * connection it does not have.
         */
        expect(seen).toEqual([]);
        w.deliver(createMessage(MessageTypes.IFRAME_APP_READY, t.iframeId, {}));
        expect(seen).toEqual(['ready']);
        w.deliver(createMessage(MessageTypes.PUBLISH_EVENT_BUS, t.iframeId, {
            eventName: 'procgenLab:ready', eventData: {},
        }));
        expect(seen).toEqual(['ready', 'procgenLab:ready']);
    });
});
