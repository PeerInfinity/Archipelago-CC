/**
 * ⛓⛓⛓ **THE FOUR-MESSAGE HANDSHAKE AN `AdapterClient` WAITS FOR — STATED ONCE.**
 *
 * Two HOSTS answer the same child (`shared/adapterClient.js`'s `AdapterClient`):
 * the app's `iframeAdapterCore.js` (`window.iframeAdapterCore`, one entry per
 * connected panel iframe) and `procgenLabPanel/labRoomEditor.js`'s
 * `createPageLabTransport` (a standalone lab page hosting the OTHER lab in a
 * frame — it has no app bus, `labRoomEditor.js:335-352`). Before this file the
 * two spelled the same four rules separately, and had already DRIFTED: the page
 * transport's docblock described a `SUBSCRIBE_EVENT_BUS` record that its
 * `onMessage` never kept (plan §17.1 row F10).
 *
 * `handshakeStep` is a REDUCER and nothing else: no `postMessage`, no window, no
 * clock of its own, no bus. It takes one inbound message and the per-frame state,
 * and returns the new state, the REPLIES to post and the EFFECTS to apply. Each
 * host keeps what is ITS — `registerIframe`/`loggingConfig`/the app-bus publish
 * and `safePostMessage` on one side; `flush()`/`onEvent`/the one-deep queue and a
 * raw `postMessage(…, origin || '*')` on the other.
 *
 * ⛔ **THE MESSAGE NAMES ARE `shared/communicationProtocol.js`'s OWN** — this file
 * spells no wire string of its own, for `labProtocol`'s reason, and imports
 * nothing else. That import is the ONLY one it is allowed: the file is in BOTH
 * hosts' static closures, and the closures must not meet (a lab page must not
 * gain `gameState`; the app must not gain a lab file).
 *
 * **The four rules, and what each is for:**
 *
 *   `IFRAME_READY`     → answer `ADAPTER_READY`, which RESOLVES the child's
 *                        `connect()` promise (`adapterClient.js:206`,
 *                        `handleAdapterReady:251`). Without it the client retries
 *                        for 10 s and rejects, and the page comes up with no
 *                        bridge at all — a working standalone page, silently.
 *                        The frame becomes REGISTERED here, and that is what the
 *                        other three rules are conditioned on.
 *   `SUBSCRIBE_EVENT_BUS` → the child says which events it wants; recorded per
 *                        frame, refused by an effect when the frame is not
 *                        registered. ⚠ The record is ROUTING, not replay: the app
 *                        reads it in `handleEventBusEvent` to decide which frames
 *                        an app-bus event reaches. NOTHING in either host re-sends
 *                        anything on a subscription — see the note below.
 *   `IFRAME_APP_READY` → the child has subscribed AND drawn
 *                        (`adapterClient.notifyAppReady:523`, called after every
 *                        `subscribeEventBus`). This is the FLUSH POINT and the
 *                        second catch-up `feedback_iframe_adapter_gotchas` names:
 *                        a publish before it reaches nobody and is not even queued.
 *   `HEARTBEAT`        → answer `HEARTBEAT_RESPONSE` and stamp `lastHeartbeat`.
 *                        ⚠ The STAMP is the load-bearing half on the app side
 *                        (`checkHeartbeats` unregisters a frame 60 s stale); the
 *                        RESPONSE is not read at all — `adapterClient.js:226-228`
 *                        is `case HEARTBEAT_RESPONSE: // Heartbeat acknowledged`,
 *                        with no body read anywhere. It is answered because the
 *                        client starts a beat on connect.
 *
 * ⛓ **`capabilities` IS A HOST PARAMETER AND NO CHILD KEYS ON IT** — measured, not
 * assumed: `capabilities` appears in `shared/adapterClient.js` only at `:131` and
 * `:154`, both OUTBOUND in the client's own `IFRAME_READY`; `handleAdapterReady`
 * reads `data.loggingConfig` and nothing else, and resolves `connect()` on the
 * message ARRIVING. So the app declares four (`eventBus`, `dispatcher`,
 * `stateManager`, `logging`) and the lab page declares one (`eventBus`), both
 * honestly, and neither list can be tested by watching the child connect.
 *
 * ⛔ **WHAT THE PAGE TRANSPORT'S OLD DOCBLOCK CLAIMED IS NOT TRUE OF EITHER HOST.**
 * It said a subscription is *"recorded, so a `load` sent before the subscription
 * can be re-sent"*. No host re-sends on `SUBSCRIBE_EVENT_BUS`; and the page side
 * never needed a record at all, because its one child — `procgenCore/labBridge.js`
 * — subscribes ×3 (`:112-124`) BEFORE `notifyAppReady()` (`:174`), which is the
 * flush point, an order that file's own docblock (`:17-19`) states as the contract.
 * The record survives here because the APP host routes on it.
 */
import { MessageTypes } from '../shared/communicationProtocol.js';

/**
 * The per-frame handshake state. Both hosts hold one of these per iframe —
 * the app derives it from its `iframes`/`eventBusSubscriptions` maps, the page
 * transport keeps the single object its single frame needs.
 * @returns {{registered: boolean, appReady: boolean, lastHeartbeat: number|null,
 *            eventBusSubscriptions: Set<string>}}
 */
export function newHandshakeState() {
    return {
        registered: false,
        appReady: false,
        lastHeartbeat: null,
        eventBusSubscriptions: new Set(),
    };
}

/** ⛓ The four this step OWNS. A host asks `handled` before running its own chain. */
export const HANDSHAKE_MESSAGES = Object.freeze([
    MessageTypes.IFRAME_READY,
    MessageTypes.IFRAME_APP_READY,
    MessageTypes.HEARTBEAT,
    MessageTypes.SUBSCRIBE_EVENT_BUS,
]);

/**
 * One inbound message against one frame's handshake state.
 *
 * ⛔ PURE: `state` is never mutated — a new object (and a new Set) comes back, so
 * a host that forgets to store the result changes nothing, loudly, rather than
 * half-applying a step.
 *
 * @param {object} state  from `newHandshakeState()`, or a host's own view of one
 * @param {object} message  a validated protocol message (`type`, `iframeId`, `data`)
 * @param {object} [o]
 * @param {string[]} [o.capabilities]  what THIS host declares in `ADAPTER_READY`;
 *   a host parameter, read by no child (see the header)
 * @param {Function} [o.now]  `() => number`, the host's clock
 * @returns {{handled: boolean, state: object,
 *            replies: Array<{type: string, data: object}>,
 *            effects: Array<object>}}
 *   `replies` are what the host must post to the child, in order, each decorated
 *   with whatever else is the host's (the app adds `adapterVersion`/`loggingConfig`
 *   to `ADAPTER_READY`). `effects` are what the host must DO:
 *     `{kind:'register'}`                      — the frame is joining
 *     `{kind:'appReady', at}`                  — the flush point was reached
 *     `{kind:'heartbeat', at}`                 — a beat landed
 *     `{kind:'subscribedEventBus', eventName}` — a new event was recorded
 *     `{kind:'refuse', code, message}`         — the frame is not registered
 */
export function handshakeStep(state, message, { capabilities = [], now = Date.now } = {}) {
    const type = message?.type;
    const nothing = { handled: false, state, replies: [], effects: [] };
    if (!HANDSHAKE_MESSAGES.includes(type)) return nothing;

    if (type === MessageTypes.IFRAME_READY) {
        const at = now();
        return {
            handled: true,
            state: { ...state, registered: true, lastHeartbeat: at },
            replies: [{ type: MessageTypes.ADAPTER_READY, data: { capabilities } }],
            effects: [{ kind: 'register' }],
        };
    }

    /**
     * ⛔ EVERY OTHER RULE IS CONDITIONED ON REGISTRATION, which is the app
     * adapter's rule (`this.iframes.has(iframeId)`) and is now the page
     * transport's too. It is unreachable for the real child — `connect()`
     * resolves on `ADAPTER_READY`, and the beat, the subscriptions and
     * `notifyAppReady()` all follow that — so it costs nothing and it means a
     * stray frame cannot flip a host's flush point.
     */
    if (!state.registered) {
        return type === MessageTypes.SUBSCRIBE_EVENT_BUS
            ? {
                handled: true,
                state,
                replies: [],
                effects: [{ kind: 'refuse', code: 'NOT_REGISTERED', message: 'Iframe not registered' }],
            }
            : { handled: true, state, replies: [], effects: [] };
    }

    if (type === MessageTypes.IFRAME_APP_READY) {
        const at = now();
        return {
            handled: true,
            state: { ...state, appReady: true },
            replies: [],
            effects: [{ kind: 'appReady', at }],
        };
    }

    if (type === MessageTypes.HEARTBEAT) {
        const at = now();
        return {
            handled: true,
            state: { ...state, lastHeartbeat: at },
            replies: [{ type: MessageTypes.HEARTBEAT_RESPONSE, data: { timestamp: at } }],
            effects: [{ kind: 'heartbeat', at }],
        };
    }

    /* SUBSCRIBE_EVENT_BUS, registered */
    const eventName = message?.data?.eventName;
    const eventBusSubscriptions = new Set(state.eventBusSubscriptions);
    eventBusSubscriptions.add(eventName);
    return {
        handled: true,
        state: { ...state, eventBusSubscriptions },
        replies: [],
        effects: [{ kind: 'subscribedEventBus', eventName }],
    };
}
