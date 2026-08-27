/**
 * procgenLabPanel/labRoomEditor — **THE HOST SIDE OF THE ROOM-EDITOR CONTRACT
 * FOR SUBSTRATES WHOSE EDITOR IS A LAB PAGE.**
 *
 * EDITOR INTEGRATION arc, slice W3 (`NewDocs/plans/editor-integration.md` §3.2,
 * §9). `regionEditors.getRegionEditor(id)` resolves a registry entry whose
 * `roomEditor.kind` is `'lab'` to this module's `openLabRoomEditor`, bound to
 * the entry's own `page` and `arm`. The maze and Seedling substrates therefore
 * get an `Edit ▸`-shaped door with NO second editor written for either: the
 * door is the lab page the arc already built, hosted in `procgenLabPanel`.
 *
 * ── ⛓⛓⛓ THREE MOVES, AND NOT ONE NEW PROTOCOL FIELD ──────────────────
 *
 *   1. **A DOCUMENT IN** — `procgenLab:load` carries the SET document
 *      (`payload` is an OPAQUE object to `assertLoad`), and each page's
 *      `load` SNIFFS it through the ONE classifier it already has, so a region
 *      library / level set / overlay lands on the SET arm's intake instead of
 *      the lab-level box.
 *   2. **ONE ROOM** — `procgenLab:navigate` with the page's own grammar,
 *      `?source=<arm>&room=<n>`. ⛔ The ARM is the registry entry's, not this
 *      file's: the maze's SET arm is `?source=set` and Seedling's edit arm is
 *      `?source=edit`, and a table here naming them would be the second place
 *      those two words live.
 *   3. **THE FOLDED DOCUMENT OUT** — `procgenLab:levelChanged`, whose payload
 *      is a `labRoomEnvelope` while a SET arm holds a session. The page's own
 *      close folds ONE `replace-room` into the record and re-announces.
 *
 * ── ⛔⛔ THE CLOSE IS A **TRANSITION**, NEVER A COUNT ──────────────────
 *
 * `onSave` fires when the envelope's `room` goes `n → null`. ⚠ Trap 599's
 * family: a wait on the number of edits cannot tell one three-cell stroke from
 * three presses, and a close that folded a NO-OP room session would move no
 * count at all — the host would sit forever on a room the reader already shut.
 * The transition is a fact about the page's session, published by the page,
 * and it is the same signal whether the reader made 0 edits or 40.
 *
 * ── ⛓ WHY THE PANEL INSTANCES ARE REGISTERED HERE ────────────────────
 *
 * `ui:activatePanel` matches on `componentType`, and BOTH lab panels are
 * `procgenLabPanel` — measured by `check-procgen-lab-hosting.mjs`, which
 * records that the event *"can only ever raise the first"* and raises the
 * Seedling tab through Golden Layout's own API instead. So a host that needs
 * *the maze one* cannot ask the layout by name; it needs the INSTANCE. The
 * panel registers itself on mount and drops itself on `destroy()` — per mount,
 * because a remounted panel that kept the old mount's entry would hand a
 * caller an iframe that is already `about:blank`.
 *
 * ⛔ THIS MODULE IMPORTS NOTHING FROM A SUBSTRATE. `procgenCore/` is the
 * shared vocabulary (`bindingContract`'s own line); a host that imported
 * `mazeRoom/` or `seedlingDemo/` would be the second place that knows what a
 * maze room is, and its own test asserts the import list.
 */

import { LAB_EVENTS, SUBSTRATES, addressedTo } from '../procgenCore/labProtocol.js';
import { openRoomOf } from '../procgenCore/labRoomEnvelope.js';
/**
 * ⛓ EDITOR INTEGRATION W4 — **THE WIRE FORMAT, FROM THE ONE PLACE IT LIVES.**
 * `shared/communicationProtocol.js` is what `AdapterClient` speaks, so a
 * transport that minted its own message names would be the second spelling of a
 * handshake the client alone decides. ⛔ `shared/` is a SUBMODULE and is READ,
 * never edited.
 */
import { MessageTypes, createMessage } from '../shared/communicationProtocol.js';

const MODULE_ID = 'procgenLabRoomEditor';

/* ══════════════════════════════════════════════════════════════════════
 * THE LIVE PANEL INSTANCES
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ EDITOR INTEGRATION W4 — **THE APP'S BUS IS REGISTERED, NOT IMPORTED, AND
 * THAT IS A DEFECT W4 FOUND BY DRIVING ITS OWN CHANGE.**
 *
 * This module imported `app/core/eventBus.js` for ONE thing: the DEFAULT value
 * of `openLabRoomEditor`'s `bus`. W4 gave `lab.html` a reason to import this
 * module (a world strip opening a Seedling room needs the contract), and
 * MEASURED what that costs a page whose own docblock says *"a standalone static
 * page — no frontend, no GL panel, no eventBus"*: importing this file printed
 * **`[centralRegistry] CentralRegistry initialized`**, and the edge is
 * `app/core/eventBus.js` itself. That is trap 829's family exactly — a
 * `loadable` module that drags the whole app graph in behind one import — one
 * host over.
 *
 * ⛓ **THE CURE IS THE INVERSION THIS FILE ALREADY USES FOR PANELS.** The panel
 * registers ITSELF on mount; now it registers the app's BUS the same way, at
 * its own import, where `eventBus` is already in the graph. ⛔ Not a dynamic
 * import: `openLabRoomEditor` is SYNCHRONOUS by contract (*"it refuses, it does
 * not throw and it does not hang"*) and awaiting a module would make every
 * refusal a promise. ⛓ And it cannot silently answer nothing: a caller with no
 * bus and no registered one has no panel either (a panel can only be mounted if
 * `procgenLabPanelUI` was imported, and importing it is what registers the
 * bus), so `findLabPanel` refuses BY NAME first.
 */
let APP_BUS = null;

/** Called by `procgenLabPanelUI.js` at ITS import — the app's own bus, once. */
export function registerAppEventBus(bus) {
    APP_BUS = bus;
}

/** ⛓ TEST-ONLY, and named so, beside `clearLabPanelInstances`. */
export function appEventBus() {
    return APP_BUS;
}

/** ⛓ Mounted `ProcgenLabPanelUI`s, newest last. See the docblock for why. */
const instances = new Set();

/** Called by `ProcgenLabPanelUI`'s constructor — ONE entry per MOUNT. */
export function registerLabPanelInstance(panel) {
    instances.add(panel);
}

/** Called by `ProcgenLabPanelUI.destroy()`. Idempotent. */
export function unregisterLabPanelInstance(panel) {
    instances.delete(panel);
}

/** ⛓ Every mounted lab panel, in mount order. */
export function labPanelInstances() {
    return [...instances];
}

/**
 * ⛓ The mounted panel showing `page`'s lab, or `null`. ⚠ `allowMultipleInstances`
 * is true, so a reader may have two maze labs open; the FIRST is taken and the
 * refusal below never fires for that case — which is the honest behaviour, a
 * host cannot know which of two identical panels the reader meant.
 */
export function findLabPanel(page) {
    for (const panel of instances) if (panel?.substrate === page) return panel;
    return null;
}

/** ⛔ TEST-ONLY, and named so — `substrateRegistry.clear()`'s convention. */
export function clearLabPanelInstances() {
    instances.clear();
}

/* ══════════════════════════════════════════════════════════════════════
 * THE DOOR
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ A refusal is a RETURN VALUE, never a throw — see `openLabRoomEditor`. */
const refuse = (why) => ({ ok: false, why, close() {} });

/**
 * Open room `room` of `record` in `page`'s lab, and call `onSave(record)` ONCE
 * when the reader closes it.
 *
 * ⛔ **IT REFUSES, IT DOES NOT THROW AND IT DOES NOT HANG.** Every way this can
 * fail before the page has the document — an unknown page, no panel mounted,
 * a payload the protocol refuses — comes back as `{ok: false, why}` in the same
 * call. The caller (`procgenPipelineUI._editRegion`, a set editor's strip) has
 * a message box and no way to time out an iframe; a promise that never settled
 * would be a room the reader is waiting on with nothing on screen.
 *
 * ⚠ AND THERE IS NO TIMER AFTER THAT. Once the document is in the page, the
 * only thing left is a PERSON editing a room, and a deadline on that would
 * discard their work at whatever number this file guessed.
 *
 * @param {object} opts
 * @param {'maze'|'seedling'} opts.page  which lab page (the registry entry's)
 * @param {string} opts.arm        that page's `?source=` for its SET arm
 * @param {number} opts.room       0-based index into the document's rooms
 * @param {object} opts.record     the SET document to hand in
 * @param {(record:object)=>void} opts.onSave  called ONCE, on the close
 * @param {object} [opts.bus]      the event bus. Absent, the APP's registered one
 *   (`registerAppEventBus`, called by `procgenLabPanelUI` at its import) — ⛔ this
 *   module does not IMPORT it, see the registry docblock
 * @param {object} [opts.transport] a PANEL-SHAPED host (EDITOR INTEGRATION W4,
 *   §9.6 #1) — `{substrate, iframeId, load, navigate, raise?, _note?}`. Supplied,
 *   it REPLACES the mounted-panel lookup, which is what lets a lab PAGE be the
 *   host. See `createPageLabTransport`.
 * @returns {{ok:boolean, why?:string, close:()=>void}}
 */
export function openLabRoomEditor({
    page, arm, room = 0, record, onSave, bus = null, transport = null,
} = {}) {
    const theBus = bus ?? APP_BUS;
    if (!SUBSTRATES.includes(page)) {
        return refuse(`labRoomEditor: page is ${JSON.stringify(page)}, not one of `
            + `[${SUBSTRATES.join(', ')}]. It names the LAB PAGE this substrate's rooms are `
            + 'edited on, and there is no page for anything else.');
    }
    if (typeof arm !== 'string' || arm === '') {
        return refuse(`labRoomEditor: arm is ${JSON.stringify(arm)} — it must be the `
            + `${page} page's own \`?source=\` for the arm that holds a SET document. ⛔ It `
            + 'comes off the registry entry, because this file must not be the second place '
            + 'those words are spelled.');
    }
    if (!Number.isInteger(room) || room < 0) {
        return refuse(`labRoomEditor: room is ${JSON.stringify(room)} — it must be a `
            + 'non-negative integer index into the document\'s rooms.');
    }
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return refuse(`labRoomEditor: record must be the SET document object, got `
            + `${JSON.stringify(record)}. ⛔ A REGION alone is not enough: the lab door hands `
            + 'the page a whole document and asks for room n of it, because that is what its '
            + 'SET arm edits — a caller holding only one region wants the `panel` kind.');
    }
    if (typeof onSave !== 'function') {
        return refuse('labRoomEditor: onSave must be a function — it is the ONLY return '
            + 'path, and an open room whose close reached nobody would lose the edit '
            + 'silently.');
    }

    /**
     * ⛓⛓⛓ EDITOR INTEGRATION W4 (§9.6 #1) — **A TRANSPORT WHOSE HOST IS A
     * PAGE.** `findLabPanel` resolves a mounted `procgenLabPanel` INSTANCE,
     * which exists in the app and does NOT exist inside `lab.html` — and ⚖ Q4
     * ruled `lab.html` is the world editor's page, so a world strip opening a
     * Seedling room has no panel to find. An injected transport is a
     * PANEL-SHAPED object (`substrate`, `iframeId`, `load`, `navigate`,
     * `raise?`, `_note?`) and everything below is unchanged: the three phases,
     * the ONE navigate, the close-as-a-TRANSITION. ⛔ The `bus` is already a
     * parameter, which is the other half — a page hands in its own.
     */
    const panel = transport ?? findLabPanel(page);
    if (!panel) {
        return refuse(`labRoomEditor: no Procgen Lab panel is mounted for ${JSON.stringify(page)}. `
            + 'Open "Procgen Lab — ' + page + '" first. ⛔ Said rather than opened: this '
            + 'module holds no layout and a host that added a panel behind the reader would '
            + 'be a second thing deciding what is on screen.');
    }

    // ⛓ Best-effort, and the row does not depend on it: a hidden Golden Layout
    //   tab has a ZERO-sized canvas, so an unraised panel is a room nobody can
    //   click. `raise()` goes through GL's own API because `ui:activatePanel`
    //   matches on componentType and both lab panels share one.
    try { panel.raise?.(); } catch { /* the layout may be mid-teardown */ }

    let sent;
    try {
        sent = panel.load(record);
    } catch (e) {
        return refuse(`labRoomEditor: the ${page} lab refused the document — ${e.message}`);
    }
    // ⚠ `false` is NOT a failure: the panel QUEUES a load for a frame that has
    //   not connected and flushes it on `iframe:appReady`. Only a throw is one.
    void sent;

    const search = `?source=${arm}&room=${room}`;

    /**
     * ⛓⛓ THE THREE PHASES, AND EACH ONE IS A FACT THE PAGE PUBLISHED.
     *   'holding'   — waiting for the page to report it is holding a SET document
     *   'open'      — the envelope named OUR room; the reader is editing
     *   'done'      — `onSave` has fired, exactly once
     */
    let phase = 'holding';
    let navigated = false;

    const handler = (data) => {
        if (phase === 'done') return;
        if (!addressedTo(data, panel.iframeId)) return;
        const open = openRoomOf(data?.payload);
        // ⛔ `undefined` = this is the LADDER payload, not a SET envelope. It is
        //   not a state change here: the page is simply not on the SET arm yet.
        if (open === undefined) return;

        if (open === room) {
            phase = 'open';
            return;
        }
        if (phase === 'open' && open === null) {
            phase = 'done';
            off();
            onSave(data.payload.record);
            return;
        }
        // ⛓ The page is holding the document with no room open — ask for ours.
        //   ⚠ ONCE: a navigate per announce would re-open the room the reader
        //   just closed, and the close would never be seen.
        if (!navigated && open === null) {
            navigated = true;
            try {
                panel.navigate(search);
            } catch (e) {
                phase = 'done';
                off();
                // ⛔ REPORTED WHERE THE PANEL REPORTS, not swallowed: a navigate
                //   the page refused leaves a document held and no room open,
                //   and a silent one would look like a reader who never pressed.
                panel._note?.(`labRoomEditor: ${e.message}`, true);
            }
        }
    };

    const off = () => {
        theBus?.unsubscribe?.(LAB_EVENTS.levelChanged, handler, MODULE_ID);
    };

    if (!theBus) {
        return refuse('labRoomEditor: no event bus — the app registers its own at '
            + '`procgenLabPanelUI`\'s import and a PAGE hands one in. ⛔ Said rather than '
            + 'defaulted: a door whose close reached nobody would lose the edit silently.');
    }
    theBus.subscribe(LAB_EVENTS.levelChanged, handler, MODULE_ID);

    return {
        ok: true,
        /** ⛓ Give up on this room. ⛔ `onSave` never fires after it. */
        close() {
            phase = 'done';
            off();
        },
    };
}

/**
 * ⛓ The shape `regionEditors.js` stores: a `roomEditor` declaration of kind
 * `'lab'` becomes ONE opener bound to that entry's page and arm, so the
 * pipeline's `open({region, contract, onSave})` and a set editor's strip call
 * the same function with the same words.
 */
export function bindLabRoomEditor({ page, arm }) {
    return (session = {}) => openLabRoomEditor({ ...session, page, arm });
}

/**
 * ⛓ …and the SECOND binding of the same kind: the host is a PAGE, so the
 * transport and its bus come from the caller and the panel registry is never
 * consulted. ⛔ A separate binder rather than an optional argument on the first
 * one, because *"which host"* is a fact about the CALLER and not about the
 * substrate — `regionEditors` resolves the registry entry and gets the panel
 * form; `lab.html` builds its own and gets this one.
 */
export function bindPageLabRoomEditor({ page, arm, transport, bus }) {
    return (session = {}) => openLabRoomEditor({ ...session, page, arm, transport, bus });
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR INTEGRATION W4 — A TRANSPORT WHOSE HOST IS A PAGE (§9.6 #1)
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⛔⛔ **WHY `procgenLabPanelUI`'s HOST HALF COULD NOT BE REUSED — MEASURED.**
 * That class takes a Golden Layout `container`, publishes on the APP's
 * `eventBus` singleton, and moves every message through
 * `window.iframeAdapterCore` — whose constructor takes the app's bus, its
 * dispatcher and its dynamic-publisher registrar and which imports
 * `gameState/singleton.js`. None of those exist inside `lab.html`, and standing
 * one up there would import the app into a standalone page. ⇒ the transport is
 * the alternative, and it is the SMALLEST thing that can be one: the child page
 * already speaks `AdapterClient` (it installs its bridge under `?iframeId=`), so
 * what is missing is the four wire messages that client waits for.
 *
 * ⛓ **NOTHING ABOUT THE CONTRACT MOVES.** `openLabRoomEditor`'s three phases,
 * its ONE navigate and its close-as-a-TRANSITION are unchanged; this supplies
 * the same four members a panel does (`substrate`, `iframeId`, `load`,
 * `navigate`) and a bus for the fifth.
 */

/**
 * ⛓ A bus for ONE page — `subscribe`/`unsubscribe`/`publish`, the three members
 * `openLabRoomEditor` uses. ⛔ Not the app's: `lab.html` has no app, and a
 * module-level singleton would leak one page's frames into the next mount.
 */
export function createPageLabBus() {
    const byEvent = new Map();
    return {
        subscribe(event, handler) {
            if (!byEvent.has(event)) byEvent.set(event, new Set());
            byEvent.get(event).add(handler);
        },
        unsubscribe(event, handler) {
            byEvent.get(event)?.delete(handler);
        },
        publish(event, data) {
            for (const handler of [...(byEvent.get(event) ?? [])]) handler(data);
        },
        /** ⛓ TEST-ONLY, and named so — how many listeners a close left behind. */
        count: (event) => (byEvent.get(event)?.size ?? 0),
    };
}

/**
 * ⛓⛓⛓ **THE FOUR WIRE MESSAGES AN `AdapterClient` WAITS FOR**, and what each
 * one is for. ⛔ The names are `shared/communicationProtocol.js`'s own — this
 * file spells no message string of its own, for `labProtocol`'s reason.
 *
 *   `IFRAME_READY`     → answer `ADAPTER_READY`, which RESOLVES the child's
 *                        `connect()` promise. Without it the client retries for
 *                        10 s and then rejects, and the page comes up with no
 *                        bridge at all (a working standalone page, silently).
 *   `SUBSCRIBE_EVENT_BUS` → the child says which events it wants. Recorded, so
 *                        a `load` sent before the subscription can be re-sent.
 *   `IFRAME_APP_READY` → the child has subscribed AND drawn. This is the flush
 *                        point, and it is the SECOND catch-up
 *                        `feedback_iframe_adapter_gotchas` names: a publish
 *                        before this reaches nobody and is not even queued.
 *   `PUBLISH_EVENT_BUS` → everything the page says, `levelChanged` included.
 *
 * ⚠ `HEARTBEAT` is answered because the client starts one on connect; nothing
 * here depends on it, and an unanswered beat is not fatal to the client either.
 *
 * @param {object} o
 * @param {'maze'|'seedling'} o.page   which lab page this frame is
 * @param {string} o.src               the page's URL, WITHOUT `iframeId`/`hostOrigin`
 * @param {HTMLElement} o.mount        where the iframe goes
 * @param {object} [o.bus]             `createPageLabBus()`'s, by default
 * @param {Function} [o.listen]        `(target, event, handler) => void` — the
 *   page's own lifetime holder, so the `message` listener is retired with the
 *   arm. Defaults to `addEventListener`, which is what a node row hands a stub for
 * @param {Function} [o.note]          `(text, bad) => void` — the page's box
 * @param {object} [o.win]             the window (`globalThis`, by default)
 * @param {object} [o.doc]             the document (`win.document`, by default)
 * @returns {{substrate, iframeId, bus, iframe, load, navigate, raise, _note, dispose}}
 */
export function createPageLabTransport({
    page, src, mount, bus = createPageLabBus(), listen = null, note = () => {},
    win = globalThis, doc = null,
} = {}) {
    const document_ = doc ?? win.document;
    const iframeId = `pagelab-${page}-${(win.__labTransportSeq = (win.__labTransportSeq ?? 0) + 1)}`;
    const origin = win.location?.origin ?? '';
    const iframe = document_.createElement('iframe');
    iframe.className = 'labRoomFrame';
    iframe.dataset.iframeId = iframeId;
    /**
     * ⛔ **THE ADDRESS IS SET BEFORE THE FRAME IS IN THE DOM.** `?iframeId=` is
     * how the child knows to install its bridge at all (both pages check it and
     * return early without it), and `&hostOrigin=` is what lets it target its
     * sends at us instead of falling back to `'*'`.
     */
    const join = src.includes('?') ? '&' : '?';
    iframe.src = `${src}${join}iframeId=${encodeURIComponent(iframeId)}`
        + `&hostOrigin=${encodeURIComponent(origin)}`;
    mount.appendChild(iframe);

    let ready = false;
    let disposed = false;
    const queued = new Map();

    const post = (type, data) => {
        const target = iframe.contentWindow;
        if (!target || disposed) return false;
        target.postMessage(createMessage(type, iframeId, data), origin || '*');
        return true;
    };

    const sendEvent = (eventName, eventData) => post(
        MessageTypes.EVENT_BUS_MESSAGE, { eventName, eventData },
    );

    /**
     * ⛓ ONE-DEEP PER VERB AND THE LAST SEND WINS — the panel's own queue rule
     * (a queue that replayed every press would make SEND mean *"this document,
     * eventually, after those other ones"*).
     */
    const flush = () => {
        for (const [eventName, eventData] of [...queued]) {
            queued.delete(eventName);
            sendEvent(eventName, eventData);
        }
    };

    const onMessage = (event) => {
        const message = event?.data;
        if (disposed || !message || typeof message !== 'object') return;
        const id = message.clientId || message.iframeId || message.windowId;
        if (id !== iframeId) return;
        const T = MessageTypes;
        if (message.type === T.IFRAME_READY) {
            post(T.ADAPTER_READY, { capabilities: ['eventBus'] });
        } else if (message.type === T.IFRAME_APP_READY) {
            ready = true;
            flush();
        } else if (message.type === T.PUBLISH_EVENT_BUS) {
            bus.publish(message.data?.eventName, message.data?.eventData);
        } else if (message.type === T.HEARTBEAT) {
            post(T.HEARTBEAT_RESPONSE, {});
        }
    };

    if (listen) listen(win, 'message', onMessage);
    else win.addEventListener('message', onMessage);

    const address = () => ({ substrate: page, iframeId });

    const send = (eventName, payload) => {
        if (!ready) { queued.set(eventName, payload); return false; }
        return sendEvent(eventName, payload);
    };

    return {
        substrate: page,
        iframeId,
        bus,
        iframe,
        load: (payload) => send(LAB_EVENTS.load, { ...address(), payload }),
        navigate: (search) => send(LAB_EVENTS.navigate, { ...address(), search }),
        /** ⛓ The frame is ON the page and there is no stack to raise it out of —
         *  a no-op that SAYS it is one rather than an absent member the opener
         *  would have to feature-detect. */
        raise: () => false,
        _note: (text, bad) => note(text, bad),
        ready: () => ready,
        dispose() {
            disposed = true;
            queued.clear();
            iframe.remove?.();
        },
    };
}
