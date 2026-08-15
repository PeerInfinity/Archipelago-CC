/**
 * procgenLabPanel/procgenLabPanelUI — **THE HOST HALF.** A Golden Layout panel
 * that mounts ONE substrate's lab page in an iframe and speaks
 * `procgenCore/labProtocol.js` to it.
 *
 * CONSTRUCTIVE-MODE arc, slice 4 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.5, ⚖ rulings 6 + 7). ⛔ The WRAPPER-PANEL pattern
 * (`textAdventureSubstrateWrapperPanel.js` / `jtaSubstrateWrapperPanel.js`) and
 * NOT the generic `iframePanel` URL loader: that panel's job is "load any URL a
 * reader types", and this one's is "this page, this substrate, this
 * vocabulary". The URL conventions are `iframePanelUI.loadIframe`'s, matched
 * deliberately — `?iframeId=`, `&hostOrigin=`, and
 * `iframeAdapterCore.setExpectedOrigin` before the `src` is set.
 *
 * ── ⛔⛔ THE RESEND, AND WHY IT IS THE WHOLE POINT OF `iframe:appReady` ──
 *
 * `eventBus` HAS NO REPLAY. A `procgenLab:load` published before the iframe has
 * subscribed reaches nobody — worse, `eventBus.publish` returns EARLY when the
 * event has no subscribers at all (`eventBus.js:121`), so the send is not even
 * a warning. And the window is real: a panel constructed in the layout's phase
 * 7 is live long before an iframe document has parsed its module graph, so
 * "press SEND right after the app boots" is the ORDINARY case, not a race.
 *
 * ⇒ a `load`/`navigate` with no connected frame is QUEUED, and flushed when
 * `iframe:appReady` names THIS iframeId. `feedback_iframe_adapter_gotchas`'s
 * standing rule (*"have the host subscribe to `iframe:appReady` and publish
 * your initial-state event"*) and `architecture_init_event_races`' mechanism 2
 * (re-publish on ready) — ⛔ not a third catch-up, the second one, applied.
 *
 * ⚠ THE QUEUE IS ONE-DEEP PER VERB and the LAST send wins. A queue that
 * replayed every press would make the panel's SEND button mean "this level,
 * eventually, after those other ones" — and the reader is looking at the last
 * thing they typed.
 *
 * ── ⛓ THE PANEL DOES NOT KNOW WHAT A LEVEL IS ─────────────────────────
 *
 * It moves payloads and mirrors an identity line. ⛔ Nothing here parses a
 * level, re-derives a seed or decides whether a page is certified — the PAGE
 * is the one renderer and the one authority (⚖ ruling 6's reasoning), and a
 * host that started interpreting would be the second test surface per control
 * that ruling exists to refuse.
 */

import eventBus from '../../app/core/eventBus.js';
import {
    LAB_EVENTS, SUBSTRATES, addressedTo, assertLoad, assertNavigate, assertRequestState,
} from '../procgenCore/labProtocol.js';

const MODULE_ID = 'procgenLabPanel';

/**
 * ⛓ THE TWO PAGES, AND THEIR BOOT QUERY.
 *
 * ⚠ `source=generate` FOR SEEDLING AND NOTHING FOR THE MAZE, and the asymmetry
 * is the two pages' own (slice 3 §10.4): `watch.html` REFUSES to infer its
 * GENERATE arm because that arm spends seconds per press, while `lab.html`
 * defaults to it because a maze solve is milliseconds. ⛔ Neither carries
 * `run=1`: a panel that ran a full ladder the moment the app booted would
 * spend the reader's first seconds on a level nobody asked for.
 */
export const LAB_PAGES = Object.freeze({
    maze: { path: './modules/mazeRoom/lab.html', query: '', title: 'Procgen Lab — maze' },
    seedling: {
        path: './modules/seedlingDemo/watch.html',
        query: 'source=generate',
        title: 'Procgen Lab — Seedling',
    },
});

/**
 * ⛓ A UNIQUE, READABLE iframeId per instance.
 *
 * ⛔ NOT `generateClientId()`'s bare default. `communicationProtocol.generateClientId`
 * is a PASSTHROUGH for a named id, so two panels sharing a name would register
 * as one entry in `iframeAdapterCore.iframes` and the second mount would
 * silently steal the first's window pointer (`feedback_iframe_adapter_gotchas`,
 * the 2026-05-23 entry — one of N substrate panels goes silent with no error).
 * ⚠ And NOT the timestamp-random default either: `allowMultipleInstances` means
 * a reader may open two maze labs, so the id must be unique — but a browser row
 * has to be able to say WHICH FRAME it is asserting about, and
 * `procgenLab-maze-1` is a name a failure message can carry.
 */
let instanceCounter = 0;
export function nextLabIframeId(substrate) {
    instanceCounter += 1;
    return `procgenLab-${substrate}-${instanceCounter}`;
}

/** ⛓ The link a reader clicks to open the frame's CURRENT view in a tab. */
export function standaloneUrlFrom(frameUrl) {
    if (typeof frameUrl !== 'string' || frameUrl === '') return null;
    let url;
    try {
        url = new URL(frameUrl, window.location.href);
    } catch {
        return null;
    }
    /**
     * ⛔ THE ADDRESS COMES OFF. `?iframeId=`/`?hostOrigin=` are how this frame
     * is reached INSIDE the host; a standalone tab carrying them would build an
     * `AdapterClient` pointed at a `window.parent` that is itself, and the page
     * would sit waiting on a handshake nobody is going to answer.
     */
    url.searchParams.delete('iframeId');
    url.searchParams.delete('hostOrigin');
    return url.toString();
}

export class ProcgenLabPanelUI {
    constructor(container, componentState) {
        this.container = container;
        this.componentState = componentState || {};
        /**
         * ⛔ AN UNKNOWN SUBSTRATE REFUSES ON THE PANEL, BY NAME. The
         * alternative — defaulting to the maze — would mount a page the layout
         * did not ask for and report its state under the other one's name.
         */
        this.substrate = this.componentState.substrate ?? SUBSTRATES[0];
        this.page = LAB_PAGES[this.substrate] ?? null;
        this.iframeId = nextLabIframeId(this.substrate);

        this.connected = false;
        this.lastState = null;
        this.lastLevel = null;
        /** ⚠ ONE-DEEP, LAST WINS — see the docblock. */
        this.pendingLoad = null;
        this.pendingNavigate = null;
        this._unsubs = [];

        this._buildDom();
        if (this.page) {
            this._subscribe();
            this._mountIframe();
        }
        this._render();
    }

    getRootElement() { return this.rootElement; }

    onMount(container) {
        if (container && typeof container.setTitle === 'function') {
            container.setTitle(this.page?.title ?? `Procgen Lab — ${this.substrate}?`);
        }
    }

    /* ══════════════════════════════════════════════════════════════════
     * THE DOM
     * ══════════════════════════════════════════════════════════════════ */

    _buildDom() {
        const el = (tag, cls, text) => {
            const n = document.createElement(tag);
            if (cls) n.className = cls;
            if (text !== undefined) n.textContent = text;
            return n;
        };
        this.rootElement = el('div', 'procgen-lab-root');
        this.rootElement.dataset.substrate = this.substrate;
        this.rootElement.dataset.iframeId = this.iframeId;

        if (!this.page) {
            this.rootElement.appendChild(el('div', 'procgen-lab-status bad',
                `procgenLabPanel: componentState.substrate is `
                + `${JSON.stringify(this.substrate)}, not one of [${SUBSTRATES.join(', ')}]. `
                + 'There is no page to mount, so nothing was mounted — a default would have '
                + 'shown one substrate\'s lab under the other one\'s name.'));
            return;
        }

        this.statusEl = el('div', 'procgen-lab-status');
        this.statusEl.dataset.role = 'status';
        this.rootElement.appendChild(this.statusEl);

        const bar = el('div', 'procgen-lab-bar');
        this.openLink = el('a', 'procgen-lab-open', 'open standalone ↗');
        this.openLink.target = '_blank';
        this.openLink.rel = 'noopener';
        this.openLink.dataset.role = 'open-standalone';
        bar.appendChild(this.openLink);

        this.sendButton = el('button', 'procgen-lab-send', 'SEND — load this payload');
        this.sendButton.dataset.role = 'send';
        this.sendButton.onclick = () => this._sendFromBox();
        bar.appendChild(this.sendButton);

        this.takeButton = el('button', 'procgen-lab-take', 'TAKE — the page\'s level');
        this.takeButton.dataset.role = 'take';
        this.takeButton.onclick = () => this._takeIntoBox();
        bar.appendChild(this.takeButton);
        this.rootElement.appendChild(bar);

        this.box = document.createElement('textarea');
        this.box.className = 'procgen-lab-box';
        this.box.dataset.role = 'payload';
        this.box.rows = 4;
        this.box.spellcheck = false;
        this.rootElement.appendChild(this.box);

        this.noteEl = el('div', 'procgen-lab-note');
        this.noteEl.dataset.role = 'note';
        this.rootElement.appendChild(this.noteEl);
    }

    _mountIframe() {
        const origin = window.location.origin;
        const query = this.page.query ? `${this.page.query}&` : '';
        const src = `${this.page.path}?${query}iframeId=${encodeURIComponent(this.iframeId)}`
            + `&hostOrigin=${encodeURIComponent(origin)}`;
        /**
         * ⛔ THE EXPECTED ORIGIN IS SET **BEFORE** THE `src`. `iframePanelUI`
         * does the same and for the same reason: the frame can send its
         * IFRAME_READY the instant it parses, and an adapter that had not yet
         * been told which origin to expect would either drop it or fall back
         * to `'*'` for the life of the connection.
         */
        if (window.iframeAdapterCore?.setExpectedOrigin) {
            let expected = null;
            try {
                expected = new URL(this.page.path, window.location.href).origin;
            } catch { expected = null; }
            window.iframeAdapterCore.setExpectedOrigin(this.iframeId, expected);
        }
        this.iframe = document.createElement('iframe');
        this.iframe.className = 'procgen-lab-iframe';
        this.iframe.setAttribute('title', this.page.title);
        // No sandbox attribute, for the reason written out in
        // textAdventureSubstrateWrapperPanel: same-origin first-party content
        // that must run its own ES module graph needs `allow-scripts
        // allow-same-origin`, which is not a boundary — only a warning.
        this.iframe.src = src;
        this.rootElement.appendChild(this.iframe);
        this.initialSrc = src;
    }

    /* ══════════════════════════════════════════════════════════════════
     * THE BUS
     * ══════════════════════════════════════════════════════════════════ */

    _on(event, handler) {
        eventBus.subscribe(event, handler, MODULE_ID);
        // ⛔ TRAP 259's HOST-SIDE TWIN: every subscription is recorded here at
        // registration, so `destroy()` cannot forget one. A hand-written
        // unsubscribe list beside the subscribe calls is the shape that drifts.
        this._unsubs.push(() => eventBus.unsubscribe?.(event, handler, MODULE_ID));
    }

    _subscribe() {
        this._on('iframe:appReady', (data) => {
            if (data?.iframeId !== this.iframeId) return;
            this.connected = true;
            /**
             * ⛓⛓⛓ THE RESEND. This is the ONE line mutant (b) removes, and the
             * gate it reddens is "a `load` sent BEFORE the frame connects must
             * still land". See the docblock for why the window is ordinary.
             */
            this._flushPending();
            this._render();
        });
        this._on(LAB_EVENTS.ready, (data) => {
            if (!addressedTo(data, this.iframeId)) return;
            this.connected = true;
            // ⚠ ALSO FLUSHES, and that is not a duplicate of the appReady
            // flush: `iframe:appReady` fires on a RELOAD of the frame too, and
            // `procgenLab:ready` is the only event that says the LAB is up
            // (the substrate named, the URL known). Flushing on both means a
            // frame that came back cannot lose a queued send to whichever
            // signal happened to arrive first. Idempotent: the queue is
            // emptied as it is flushed.
            this._flushPending();
            this._render();
        });
        this._on(LAB_EVENTS.stateChanged, (data) => {
            if (!addressedTo(data, this.iframeId)) return;
            this.lastState = data;
            this.connected = true;
            this._render();
        });
        this._on(LAB_EVENTS.levelChanged, (data) => {
            if (!addressedTo(data, this.iframeId)) return;
            this.lastLevel = data.payload;
            this._render();
        });
        this._on(LAB_EVENTS.selectTile, (data) => {
            if (!addressedTo(data, this.iframeId)) return;
            this.lastTile = { tx: data.tx, ty: data.ty };
            this._render();
        });
    }

    _publish(event, payload, assert) {
        assert(payload);
        eventBus.publish(event, payload, MODULE_ID);
    }

    _address() { return { substrate: this.substrate, iframeId: this.iframeId }; }

    /* ══════════════════════════════════════════════════════════════════
     * THE THREE VERBS
     * ══════════════════════════════════════════════════════════════════ */

    /** Load a level payload into the frame. Queued while it is not connected. */
    load(payload) {
        const message = { ...this._address(), payload };
        assertLoad(message);
        if (!this.connected) {
            this.pendingLoad = message;
            this._note('queued — the frame has not connected yet; it will be sent on '
                + 'iframe:appReady');
            return false;
        }
        this._publish(LAB_EVENTS.load, message, assertLoad);
        return true;
    }

    /** Drive the frame's URL grammar. Queued while it is not connected. */
    navigate(search) {
        const message = { ...this._address(), search };
        assertNavigate(message);
        if (!this.connected) {
            this.pendingNavigate = message;
            return false;
        }
        this._publish(LAB_EVENTS.navigate, message, assertNavigate);
        return true;
    }

    /** Ask the frame to restate itself. Never queued — it is a question. */
    requestState() {
        if (!this.connected) return false;
        this._publish(LAB_EVENTS.requestState, this._address(), assertRequestState);
        return true;
    }

    _flushPending() {
        // ⛔ NAVIGATE FIRST, THEN LOAD. A navigate re-mounts the arm from the
        // URL, so the other order would run the load and then throw it away.
        if (this.pendingNavigate) {
            const m = this.pendingNavigate;
            this.pendingNavigate = null;
            this._publish(LAB_EVENTS.navigate, m, assertNavigate);
        }
        if (this.pendingLoad) {
            const m = this.pendingLoad;
            this.pendingLoad = null;
            this._publish(LAB_EVENTS.load, m, assertLoad);
        }
    }

    /* ══════════════════════════════════════════════════════════════════
     * THE BUTTONS
     * ══════════════════════════════════════════════════════════════════ */

    _sendFromBox() {
        let payload;
        try {
            payload = JSON.parse(this.box.value);
        } catch (e) {
            // ⛔ VERBATIM, and the box is not cleared: the reader's text is
            // their work and a panel that ate it on a typo would be the input/
            // readout confusion `resetPageChrome` is careful about one page down.
            this._note(`that is not JSON — ${e.message}`, true);
            return;
        }
        try {
            const sent = this.load(payload);
            if (sent) this._note('SENT — the page reconstructs it and reports agreement');
        } catch (e) {
            this._note(e.message, true);
        }
    }

    _takeIntoBox() {
        if (!this.lastLevel) {
            this._note('nothing to take yet — the page has not reported a level '
                + '(procgenLab:levelChanged)', true);
            return;
        }
        this.box.value = JSON.stringify(this.lastLevel, null, 2);
        this._note('TAKEN — the last level the page reported');
    }

    _note(text, bad = false) {
        if (!this.noteEl) return;
        this.noteEl.textContent = text;
        this.noteEl.classList.toggle('bad', bad);
    }

    /* ══════════════════════════════════════════════════════════════════
     * THE READOUT
     * ══════════════════════════════════════════════════════════════════ */

    /**
     * ⛓ THE STATUS LINE, AS A PURE FUNCTION OF WHAT ARRIVED. Exported shape so
     * a headless test can assert the sentence without a DOM: the panel's whole
     * v1 job is mirroring, and "does it mirror" is the only thing to check.
     */
    statusText() {
        if (!this.page) return 'no such substrate';
        if (!this.connected) return `${this.substrate} · connecting…`;
        const s = this.lastState;
        if (!s) return `${this.substrate} · connected · (the page has not reported a state)`;
        /**
         * ⛔ THREE WORDS, NOT TWO. `null` is CERTIFIED-UNKNOWN — nobody has
         * asked — and `false` is the oracle refusing; a panel that printed
         * "UNCERTIFIED" for both would merge the distinction both pages keep
         * (trap 262) at the last step before a human reads it.
         */
        const cert = s.certified === null ? 'CERTIFIED?' : (s.certified ? 'CERTIFIED' : 'UNCERTIFIED');
        return `${this.substrate} · connected · ${s.identity} · ${cert} · ${s.edits} edit(s)`;
    }

    _render() {
        if (!this.page) return;
        this.statusEl.textContent = this.statusText();
        /**
         * ⛔ FROM THE LAST `stateChanged`, NOT FROM `initialSrc`. The page
         * rewrites its own bar on every press (its ONE writer), so the initial
         * src stops naming what the frame is showing at the first STEP — and
         * "open standalone" that opened the run BEFORE the one on screen would
         * be the layout-consistency payoff pointing at the wrong level.
         */
        const href = standaloneUrlFrom(this.lastState?.url ?? '');
        if (href) {
            this.openLink.href = href;
            this.openLink.removeAttribute('aria-disabled');
        } else {
            this.openLink.removeAttribute('href');
            this.openLink.setAttribute('aria-disabled', 'true');
        }
    }

    destroy() {
        for (const off of this._unsubs) {
            try { off(); } catch { /* the bus may already be gone */ }
        }
        this._unsubs = [];
        if (this.iframe) {
            if (window.iframeAdapterCore?.unregisterIframe) {
                window.iframeAdapterCore.unregisterIframe(this.iframeId);
            }
            this.iframe.src = 'about:blank';
            this.iframe = null;
        }
        if (this.rootElement?.parentNode) {
            this.rootElement.parentNode.removeChild(this.rootElement);
        }
        this.rootElement = null;
    }
}
