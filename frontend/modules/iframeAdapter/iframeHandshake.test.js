/**
 * ⛓⛓⛓ **THE HANDSHAKE STEP — the four rules, once.**
 *
 * `iframeHandshake.js` exists because two hosts answered the same child with two
 * copies of these rules and one had already drifted (plan §17.1 row F10). The
 * rows below are the rules themselves; the two hosts' rows
 * (`procgenLabPanel/labRoomEditor.test.js`, and the in-app iframe base tests plus
 * `check-procgen-lab-hosting.mjs` for the app adapter) assert that each host
 * APPLIES them.
 *
 * ⛔ The last two rows read `shared/adapterClient.js` — the CHILD, in the `shared`
 * submodule, READ and never written. They are the pins for the two decisions this
 * slice made about reply CONTENT, because a claim about what a child ignores is
 * unfalsifiable in prose.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { MessageTypes } from '../shared/communicationProtocol.js';
import { handshakeStep, newHandshakeState, HANDSHAKE_MESSAGES } from './iframeHandshake.js';

const CAPS = ['eventBus', 'dispatcher'];
const tick = () => { let t = 1000; return () => (t += 7); };
const msg = (type, data = {}) => ({ type, iframeId: 'frame-1', data });
/** ⛓ READY first, because every other rule is conditioned on registration. */
const registered = (now) => handshakeStep(newHandshakeState(), msg(MessageTypes.IFRAME_READY),
    { capabilities: CAPS, now }).state;

describe('handshakeStep — rule 1, IFRAME_READY', () => {
    it('answers ADAPTER_READY carrying THIS HOST\'s declared capabilities, and registers', () => {
        const now = tick();
        const step = handshakeStep(newHandshakeState(), msg(MessageTypes.IFRAME_READY),
            { capabilities: CAPS, now });
        expect(step.handled).toBe(true);
        expect(step.replies).toEqual([
            { type: MessageTypes.ADAPTER_READY, data: { capabilities: CAPS } },
        ]);
        /**
         * ⛔ **THE LIST IS A HOST PARAMETER, NOT A CONSTANT OF THE PROTOCOL** —
         * the app declares four and the lab page declares one. A helper that
         * spelled either would make one host lie.
         */
        const other = handshakeStep(newHandshakeState(), msg(MessageTypes.IFRAME_READY),
            { capabilities: ['eventBus'], now });
        expect(other.replies[0].data.capabilities).toEqual(['eventBus']);
        expect(step.effects).toEqual([{ kind: 'register' }]);
        expect(step.state.registered).toBe(true);
        expect(step.state.lastHeartbeat).toEqual(expect.any(Number));
    });

    it('does NOT mutate the state it was given — a host that drops the result changes nothing', () => {
        const now = tick();
        const before = registered(now);
        const snapshot = { ...before, eventBusSubscriptions: new Set(before.eventBusSubscriptions) };
        const step = handshakeStep(before, msg(MessageTypes.SUBSCRIBE_EVENT_BUS, { eventName: 'a' }),
            { capabilities: CAPS, now });
        /** ⛔ the Set too — a shared Set would let a dropped result land anyway */
        expect(before).toEqual(snapshot);
        expect([...before.eventBusSubscriptions]).toEqual([]);
        expect(step.state).not.toBe(before);
        expect(step.state.eventBusSubscriptions).not.toBe(before.eventBusSubscriptions);
    });
});

describe('handshakeStep — rule 2, IFRAME_APP_READY (the FLUSH POINT)', () => {
    it('flips appReady and emits the effect, with NO reply — the host does the flushing', () => {
        const now = tick();
        const step = handshakeStep(registered(now), msg(MessageTypes.IFRAME_APP_READY), { now });
        expect(step.state.appReady).toBe(true);
        expect(step.replies).toEqual([]);
        expect(step.effects.map((e) => e.kind)).toEqual(['appReady']);
        /** ⛓ the stamp the app bus publishes as `iframe:appReady`'s `timestamp` */
        expect(step.effects[0].at).toEqual(expect.any(Number));
    });
});

describe('handshakeStep — rule 3, HEARTBEAT', () => {
    it('answers HEARTBEAT_RESPONSE and stamps lastHeartbeat with the SAME instant', () => {
        const now = tick();
        const state = registered(now);
        const step = handshakeStep(state, msg(MessageTypes.HEARTBEAT), { now });
        expect(step.replies).toEqual([
            { type: MessageTypes.HEARTBEAT_RESPONSE, data: { timestamp: step.state.lastHeartbeat } },
        ]);
        /**
         * ⛔ **THE STAMP IS THE LOAD-BEARING HALF, NOT THE REPLY.**
         * `iframeAdapterCore.checkHeartbeats` unregisters a frame whose stamp is
         * 60 s stale; the child reads no part of the response body
         * (`adapterClient.js:226-228`, pinned below). A step that answered
         * without stamping would look right on the wire and drop the frame.
         */
        expect(step.state.lastHeartbeat).toBeGreaterThan(state.lastHeartbeat);
        expect(step.effects).toEqual([{ kind: 'heartbeat', at: step.state.lastHeartbeat }]);
    });

    it('is ORDER-INDEPENDENT — before or after the flush point, same reply, and it moves nothing else', () => {
        const now = tick();
        const early = handshakeStep(registered(now), msg(MessageTypes.HEARTBEAT), { now });
        const late = handshakeStep(
            handshakeStep(registered(now), msg(MessageTypes.IFRAME_APP_READY), { now }).state,
            msg(MessageTypes.HEARTBEAT), { now },
        );
        expect(early.replies.map((r) => r.type)).toEqual(late.replies.map((r) => r.type));
        /** ⛓ a beat neither reaches nor un-reaches the flush point */
        expect(early.state.appReady).toBe(false);
        expect(late.state.appReady).toBe(true);
        /** ⛓ …nor disturbs a subscription taken before it */
        const subscribed = handshakeStep(registered(now),
            msg(MessageTypes.SUBSCRIBE_EVENT_BUS, { eventName: 'procgenLab:load' }), { now }).state;
        const beat = handshakeStep(subscribed, msg(MessageTypes.HEARTBEAT), { now });
        expect([...beat.state.eventBusSubscriptions]).toEqual(['procgenLab:load']);
    });
});

describe('handshakeStep — rule 4, SUBSCRIBE_EVENT_BUS', () => {
    it('RECORDS each event name, accumulating — the app routes app-bus events on this set', () => {
        const now = tick();
        let state = registered(now);
        const names = ['procgenLab:load', 'procgenLab:navigate', 'procgenLab:requestState'];
        const effects = [];
        for (const eventName of names) {
            const step = handshakeStep(state, msg(MessageTypes.SUBSCRIBE_EVENT_BUS, { eventName }), { now });
            state = step.state;
            effects.push(...step.effects);
        }
        expect([...state.eventBusSubscriptions]).toEqual(names);
        expect(effects).toEqual(names.map((eventName) => ({ kind: 'subscribedEventBus', eventName })));
        /** ⛓ a repeat is not a second record, and not a second effect's worth of work either */
        const again = handshakeStep(state, msg(MessageTypes.SUBSCRIBE_EVENT_BUS, { eventName: names[0] }), { now });
        expect([...again.state.eventBusSubscriptions]).toEqual(names);
    });
});

describe('handshakeStep — the UNREGISTERED frame, and messages that are not ours', () => {
    it('REFUSES a subscription from a frame that never sent IFRAME_READY', () => {
        const step = handshakeStep(newHandshakeState(),
            msg(MessageTypes.SUBSCRIBE_EVENT_BUS, { eventName: 'x' }), { capabilities: CAPS });
        expect(step.handled).toBe(true);
        expect(step.replies).toEqual([]);
        expect(step.effects).toEqual([
            { kind: 'refuse', code: 'NOT_REGISTERED', message: 'Iframe not registered' },
        ]);
        expect([...step.state.eventBusSubscriptions]).toEqual([]);
    });

    it('answers NOTHING to a beat or a flush point from an unregistered frame', () => {
        for (const type of [MessageTypes.HEARTBEAT, MessageTypes.IFRAME_APP_READY]) {
            const step = handshakeStep(newHandshakeState(), msg(type), { capabilities: CAPS });
            expect(step.handled).toBe(true);
            expect(step.replies).toEqual([]);
            expect(step.effects).toEqual([]);
            expect(step.state.appReady).toBe(false);
        }
    });

    it('reports `handled:false` for a message it does not OWN, so the host\'s own chain still runs', () => {
        const now = tick();
        for (const type of [MessageTypes.PUBLISH_EVENT_BUS, MessageTypes.REQUEST_STATE_SNAPSHOT,
            MessageTypes.UNSUBSCRIBE_EVENT_BUS, 'NOT_A_MESSAGE_TYPE']) {
            const state = registered(now);
            const step = handshakeStep(state, msg(type), { capabilities: CAPS, now });
            expect(step.handled).toBe(false);
            expect(step.state).toBe(state);
            expect(step.replies).toEqual([]);
            expect(step.effects).toEqual([]);
        }
        /** ⛓ …and the ones it DOES own are exactly `HANDSHAKE_MESSAGES`, derived from the export */
        expect(HANDSHAKE_MESSAGES.every((t) => typeof t === 'string' && MessageTypes[t] === t)).toBe(true);
        expect(HANDSHAKE_MESSAGES.filter((t) =>
            handshakeStep(newHandshakeState(), msg(t), { capabilities: CAPS }).handled).length)
            .toBe(HANDSHAKE_MESSAGES.length);
    });
});

/**
 * ⛓⛓⛓ **THE TWO DECISIONS ABOUT REPLY CONTENT, PINNED AGAINST THE CHILD'S OWN
 * SOURCE.** Both hosts USED to disagree about what an `ADAPTER_READY` and a
 * `HEARTBEAT_RESPONSE` carry. Unifying them is only safe because the child reads
 * neither — and *"the child ignores it"* is exactly the kind of claim that rots
 * silently, so it is a row over `shared/adapterClient.js`, the file the child is.
 */
describe('the CHILD, read — why one shape is safe', () => {
    const CLIENT = readFileSync(
        fileURLToPath(new URL('../shared/adapterClient.js', import.meta.url)), 'utf8');
    const bodyAfter = (needle, stop) => {
        const from = CLIENT.indexOf(needle);
        expect(from).toBeGreaterThan(-1);
        const to = CLIENT.indexOf(stop, from + needle.length);
        expect(to).toBeGreaterThan(from);
        return CLIENT.slice(from, to);
    };

    it('never READS `capabilities` — every mention is the client\'s OWN outbound list', () => {
        const lines = CLIENT.split('\n')
            .map((line, i) => ({ line, n: i + 1 }))
            .filter(({ line }) => line.includes('capabilities'));
        expect(lines.length).toBeGreaterThan(0);
        /**
         * ⛔ Each one is a `capabilities: [...]` PROPERTY the client sends in its
         * own `IFRAME_READY`/`WINDOW_READY`; none is a read of `message.data`.
         */
        for (const { line } of lines) {
            expect(line).toMatch(/capabilities:\s*\[/);
            expect(line).not.toMatch(/data\??\.\s*capabilities|\.capabilities\b/);
        }
        /** ⛓ …and the ADAPTER_READY handler — where a read would have to live — has none */
        const handler = bodyAfter('handleAdapterReady(message) {', '\n    /**');
        expect(handler).toContain('loggingConfig');
        expect(handler).not.toContain('capabilities');
    });

    it('never READS the HEARTBEAT_RESPONSE body — the case is an acknowledgement and nothing else', () => {
        const clause = bodyAfter(`case MessageTypes.HEARTBEAT_RESPONSE:`, 'break;');
        expect(clause.split('\n').map((l) => l.trim()).filter(Boolean)).toEqual([
            'case MessageTypes.HEARTBEAT_RESPONSE:',
            '// Heartbeat acknowledged',
        ]);
    });
});
