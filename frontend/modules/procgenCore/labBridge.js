/**
 * procgenCore/labBridge — **THE IN-PAGE HALF OF THE HOSTING CONTRACT, ONCE.**
 * Connect to the host over the existing iframe adapter, route the three
 * host→page events by `iframeId`, publish the four page→host ones.
 *
 * CONSTRUCTIVE-MODE arc, slice 4 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.5). The vocabulary is `labProtocol.js`; this is the transport
 * and the routing, and it is a THIRD file because the two bridges'
 * connect/route/publish bodies were byte-identical apart from four function
 * references. ⚖ §5's ONE OF EVERYTHING: two copies of "which events do I
 * subscribe to and in what order relative to `notifyAppReady`" is exactly the
 * pair that drifts, and the drift is silent (an event published before the
 * iframe subscribes is simply LOST — `feedback_iframe_adapter_gotchas`).
 *
 * ── ⛔⛔ THE ORDER IS THE CONTRACT ─────────────────────────────────────
 *
 *   1. `client.connect()`            — the adapter registers this iframeId
 *   2. `subscribeEventBus` × 3       — the host bus now HAS these events
 *   3. `client.notifyAppReady()`     — the host publishes `iframe:appReady`
 *   4. publish `procgenLab:ready`    — the page's own "I am up and drawn"
 *
 * ⛔ 2 BEFORE 3, ALWAYS. `iframe:appReady` is the host panel's cue to (re)send
 * any `load`/`navigate` it queued before this frame existed; if the
 * subscriptions were not in place first, the resend would arrive at an iframe
 * the adapter does not yet know is listening and vanish — which is the exact
 * failure mutant (b) reproduces on purpose.
 *
 * ⚠ AND 4 IS NOT A DUPLICATE OF 3. `iframe:appReady` says *an* iframe app is
 * up and carries only `{iframeId, timestamp}`; `procgenLab:ready` says *this
 * lab page* is up, names its SUBSTRATE and its URL, and is what a reader (or a
 * browser row) can assert the identity of a frame from.
 *
 * ── ⛓ `levelChanged` IS DERIVED FROM THE WORLD, NOT FROM A CALLER'S CLAIM ──
 *
 * §3.5 says `levelChanged` fires *"on KEPT / edit / load"*. This file does not
 * take that as three call sites: it serialises the page's payload on every
 * announce and publishes when the LEVEL differs from the last one published.
 * Trap 263's law (*"ask the world, not the tool that changed it"*), which the
 * maze page already paid for once: `mazeLab.applyEdit` had to stop trusting
 * the editor's own descriptor because a no-op click was reported as a change.
 * A caller-driven `levelChanged` has the same shape — a page that forgot one
 * of the three sites would go silent with no symptom, and one that called it
 * on every render would flood the host with identical levels.
 *
 * ⛔ NO DOM. The bridge registers no `addEventListener` of its own (the one
 * `message` listener belongs to `AdapterClient`, inside `shared/`), so it adds
 * nothing the pages' lifetime holders would need to see — the pages' law
 * (trap 259: `watchViewer.js`/`mazeLabView.js` may not call `addEventListener`
 * at all) is not weakened by it. `dispose()` exists for symmetry with the
 * host panel's `destroy()` and stops every publish at the source.
 */

import {
    LAB_EVENTS, addressedTo, assertLevelChanged, assertLoad, assertNavigate, assertReady,
    assertRequestState, assertSelectTile, assertStateChanged,
} from './labProtocol.js';

/**
 * @param {object} opts
 * @param {'maze'|'seedling'} opts.substrate
 * @param {object} opts.client         a connected-or-connectable AdapterClient
 * @param {string} opts.iframeId       this frame's id (the client's own clientId)
 * @param {object} opts.page           the page adapter — see below
 * @param {(level:string,...a:any[])=>void} [opts.log]
 *
 * `page` is the ONE seam between this file and a substrate's page:
 *   `summary()`  → `{url, source, seed, step, identity, certified, edits, directives}`
 *                  (the page's OWN summary object's fields — never re-derived here)
 *   `payload()`  → the full level payload object, or null before the first draw
 *   `load(payloadObject)`  → the page's ONE reconstruction
 *   `navigate(searchString)` → the page's ONE URL reader, no reload
 */
export async function createLabBridge({ substrate, client, iframeId, page, log = () => {} }) {
    let disposed = false;
    /**
     * ⛓ THE LAST LEVEL PUBLISHED, as its serialised form. `null` before the
     * first announce, so the first drawn level always counts as a change.
     */
    let lastLevelJson = null;

    const address = () => ({ substrate, iframeId });

    const publish = (event, payload, assert) => {
        if (disposed) return null;
        assert(payload);
        client.publishEventBus(event, payload);
        return payload;
    };

    /**
     * ⛔ THE ROUTING PREDICATE IS `labProtocol.addressedTo`, NOT A LOCAL
     * COMPARISON. Two panels are open; the adapter forwards a host publish to
     * every iframe subscribed to the name, so a frame that did not filter
     * would load the OTHER frame's level and report it as its own.
     */
    const mine = (payload) => addressedTo(payload, iframeId);

    const connected = await client.connect().catch((e) => {
        // ⛔ RAW TRUTH, and the page stays a page. A lab page that could not
        // reach a host is still a working standalone document; it simply has
        // no bridge. The refusal is reported, not swallowed.
        log('error', `procgenLab: connect() refused — ${e.message}`);
        return false;
    });
    if (connected === false) {
        return { iframeId, substrate, connected: false, announce() {}, selectTile() {},
            dispose() { disposed = true; } };
    }

    /* ── 2. SUBSCRIBE, BEFORE notifyAppReady ──────────────────────────── */

    client.subscribeEventBus(LAB_EVENTS.load, async (data) => {
        if (!mine(data)) return;
        assertLoad(data);
        await page.load(data.payload);
    });

    client.subscribeEventBus(LAB_EVENTS.navigate, async (data) => {
        if (!mine(data)) return;
        assertNavigate(data);
        await page.navigate(data.search);
    });

    client.subscribeEventBus(LAB_EVENTS.requestState, (data) => {
        if (!mine(data)) return;
        assertRequestState(data);
        // ⚠ FORCED, not conditional: `requestState` is a question, and
        // answering it only when something changed would leave the asker
        // waiting for an event that is never coming.
        announce({ force: true });
    });

    /* ── THE PUBLISHES ────────────────────────────────────────────────── */

    /**
     * ⛓ ONE ENTRY FROM THE PAGE, called from its RENDER. Publishes
     * `stateChanged` every time (it is small and the host mirrors it), and
     * `levelChanged` only when the level actually moved.
     */
    function announce({ force = false } = {}) {
        if (disposed) return null;
        const summary = page.summary();
        if (!summary) return null;
        const state = publish(LAB_EVENTS.stateChanged, {
            ...address(),
            url: summary.url,
            source: summary.source,
            seed: summary.seed,
            step: summary.step,
            identity: summary.identity,
            certified: summary.certified,
            edits: summary.edits,
            directives: summary.directives,
        }, assertStateChanged);

        const payload = page.payload();
        if (payload) {
            const levelJson = JSON.stringify(payload.level ?? payload);
            if (force || levelJson !== lastLevelJson) {
                lastLevelJson = levelJson;
                publish(LAB_EVENTS.levelChanged, { ...address(), payload }, assertLevelChanged);
            }
        }
        return state;
    }

    /** ⛓ A canvas click, in TILE coordinates — the page converted the pixels. */
    function selectTile(tx, ty) {
        return publish(LAB_EVENTS.selectTile, { ...address(), tx, ty }, assertSelectTile);
    }

    /* ── 3 + 4. READY ─────────────────────────────────────────────────── */

    client.notifyAppReady();
    publish(LAB_EVENTS.ready, { ...address(), url: page.summary()?.url ?? '' }, assertReady);
    // ⛔ AND THE FIRST STATE WITH IT. A host that mounted before the page drew
    // would otherwise sit on "connected" with an empty status line until the
    // reader pressed something — the page HAS a state at `ready` and saying so
    // costs one small event.
    announce({ force: true });

    log('info', `procgenLab: ${substrate} bridge connected as ${iframeId}`);

    return {
        iframeId,
        substrate,
        connected: true,
        announce,
        selectTile,
        dispose() { disposed = true; },
    };
}
