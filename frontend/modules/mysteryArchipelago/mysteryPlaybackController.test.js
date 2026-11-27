import { describe, expect, it } from 'vitest';
import {
    MYSTERY_AUTO_SOLVE_EVENT as ASK, MYSTERY_AUTO_SOLVE_STATUS_EVENT as STATUS, MYSTERY_WALK_FAILURES as FAILURES,
    MYSTERY_WALK_REFUSALS as REFUSALS, MYSTERY_WALK_TIMINGS as TIMINGS, createMysteryPlaybackController, describeWaiting,
} from './mysteryPlaybackController.js';
import { PLAYBACK_WALK_FAILED_EVENT as FAILED } from '../procgenCore/playbackEvents.js';

const OFFICE = 'The case';
const office = () => ({
    regionId: OFFICE,
    payload: {
        story: 's',
        ap_locations: { 'q.a': 'Question 01', 'q.b': 'Question 02' },
        papers: {},
        exits: new Map([['Down to the street', { exitName: 'Down to the street', targetRegion: 'The street' }]]),
    },
});
const Q2 = { kind: 'location', name: 'Question 02' };

/** A controller over a fake bus, dispatcher and clock; `env.tick(ms)` runs the timers due. */
function setup({ here = OFFICE, regions = [office()], pageAsked = true } = {}) {
    const env = { sent: [], moved: [], opened: 0, changes: 0, pageAsked, handlers: new Map(), timers: [], now: 0 };
    const eventBus = {
        publish: (event, payload) => env.sent.push({ event, payload }),
        subscribe: (event, handler) => env.handlers.set(event, handler),
    };
    const clock = {
        setTimeout: (fn, ms) => { const id = {}; env.timers.push({ id, fn, at: env.now + ms }); return id; },
        clearTimeout: (id) => { env.timers = env.timers.filter((t) => t.id !== id); },
    };
    env.controller = createMysteryPlaybackController({
        dispatcher: { publish: (event, payload, options) => env.moved.push({ event, payload, options }) },
        eventBus, clock,
        getCaseRegions: () => regions,
        getActiveRegionId: () => here,
        pageHasAsked: () => env.pageAsked,
        openPanel: () => { env.opened += 1; },
        onWalkingChanged: () => { env.changes += 1; },
        substrateId: 'mystery', sourceModule: 'mysteryArchipelago',
    });
    env.fire = (event, payload) => env.handlers.get(event)(payload);
    env.tick = (ms) => {
        env.now += ms;
        for (const t of env.timers.filter((x) => x.at <= env.now)) { env.timers = env.timers.filter((x) => x !== t); t.fn(); }
    };
    env.asks = () => env.sent.filter((s) => s.event === ASK).map((s) => s.payload);
    env.failures = () => env.sent.filter((s) => s.event === FAILED).map((s) => s.payload);
    return env;
}

describe('the mystery playback controller: a question', () => {
    it('asks the page for that one question, and is walking the region until the page says done', () => {
        const env = setup();
        expect(env.controller.walkTo(Q2)).toBe(true);
        expect(env.controller.walking()).toBe(OFFICE);
        expect(env.asks()).toEqual([{ story: 's', question: 'q.b' }]);
        expect(env.moved).toEqual([]); // the check is the page's own solved question, never a host check
        env.fire(STATUS, { story: 's', question: 'q.b', state: 'running' });
        env.fire(STATUS, { story: 's', question: 'q.b', state: 'done' });
        expect(env.controller.walking()).toBeNull();
        expect(env.changes).toBe(2); // told when the walk began and when it ended
        expect(env.failures()).toEqual([]);
    });

    it('the bot names the pace before its target: Instant asks for one burst, Play leaves the pace to the page', () => {
        const env = setup();
        env.controller.setInstant(true);
        env.controller.walkTo(Q2);
        // The bot's clock commands between targets say nothing of the pace.
        env.controller.instant();
        env.controller.step();
        env.controller.play();
        env.fire(STATUS, { question: 'q.b', state: 'done' });
        env.controller.walkTo(Q2);
        env.fire(STATUS, { question: 'q.b', state: 'done' });
        env.controller.setInstant(false);
        env.controller.walkTo(Q2);
        env.fire(STATUS, { question: 'q.b', state: 'done' });
        env.controller.setInstant(true);
        env.controller.reset();
        env.controller.walkTo(Q2);
        expect(env.asks().map((a) => a.instant ?? false)).toEqual([true, true, false, false]);
    });

    it('a loops Bot block\'s perform is always one burst', () => {
        const env = setup();
        expect(env.controller.perform(Q2)).toBe(true);
        expect(env.asks()).toEqual([{ story: 's', question: 'q.b', instant: true }]);
        expect(env.controller.perform({ kind: 'explore', region: OFFICE })).toBe(false);
    });

    it('with no page there, it opens the panel and asks once the page asks for a state', () => {
        const env = setup({ pageAsked: false });
        expect(env.controller.walkTo(Q2)).toBe(true);
        expect([env.opened, env.asks().length, env.controller.walking()]).toEqual([1, 0, OFFICE]);
        env.fire('mystery:requestState', { story: 's' });
        env.fire('mystery:requestState', { story: 's' });
        expect(env.asks()).toEqual([{ story: 's', question: 'q.b' }]);
    });

    it('a page that never opens ends the walk by name', () => {
        const env = setup({ pageAsked: false });
        env.controller.walkTo(Q2);
        env.tick(TIMINGS.pageMs);
        expect(env.failures()).toEqual([{ substrate: 'mystery', target: Q2, reason: FAILURES.NO_PAGE }]);
        expect(env.controller.walking()).toBeNull();
    });

    it('a page that says nothing is opened and asked once more; a second silence ends the walk by name', () => {
        const env = setup();
        env.controller.walkTo(Q2);
        env.tick(TIMINGS.answerMs);
        expect([env.opened, env.failures().length]).toEqual([1, 0]);
        env.fire('mystery:requestState', { story: 's' });
        expect(env.asks()).toHaveLength(2);
        env.tick(TIMINGS.answerMs);
        expect(env.failures().map((f) => f.reason)).toEqual([FAILURES.NO_ANSWER]);
    });

    it('the page\'s own word ends the walk by name: failed, stopped (locked), and a waiting that does not clear', () => {
        const failed = setup();
        failed.controller.walkTo(Q2);
        failed.fire(STATUS, { question: 'q.b', state: 'failed', failed: 'no way on' });
        expect(failed.failures()[0].reason).toBe(`${FAILURES.PAGE_FAILED}: no way on`);
        const stopped = setup();
        stopped.controller.walkTo(Q2);
        stopped.fire(STATUS, { question: 'q.b', state: 'stopped', locked: true });
        expect(stopped.failures()[0].reason).toBe(`${FAILURES.PAGE_STOPPED}: the page is locked`);
        const waiting = setup();
        waiting.controller.walkTo(Q2);
        waiting.fire(STATUS, { question: 'q.b', state: 'waiting', waiting: ['note'] });
        waiting.tick(TIMINGS.waitingMs - 1);
        expect(waiting.failures()).toEqual([]);
        waiting.tick(1);
        expect(waiting.failures()[0].reason).toBe(`${FAILURES.PAGE_WAITING}: note`);
    });

    it('a waiting is named in words, as the page sends it (question, then what each way lacks)', () => {
        expect(describeWaiting([{ question: 'q.bell', ways: [{ papers: ['rowe'], requires: [] }] }])).toBe('q.bell (papers rowe)');
        expect(describeWaiting([{ question: 'q.x', ways: [{ papers: ['a', 'b'], requires: ['q.y'] }, { papers: ['c'] }] }, 'q.z']))
            .toBe('q.x (papers a, b; questions q.y | papers c), q.z');
        expect(describeWaiting([])).toBeUndefined();
        expect(describeWaiting(undefined)).toBeUndefined();
    });

    it('a waiting that clears goes on: running, then done', () => {
        const env = setup();
        env.controller.walkTo(Q2);
        env.fire(STATUS, { question: 'q.b', state: 'waiting' });
        env.fire(STATUS, { question: 'q.b', state: 'running' });
        env.tick(TIMINGS.waitingMs * 2);
        env.fire(STATUS, { question: 'q.b', state: 'done' });
        expect([env.failures().length, env.controller.walking()]).toEqual([0, null]);
    });

    it('a status for another question, or with no walk in flight, is not its business', () => {
        const env = setup();
        env.fire(STATUS, { question: 'q.b', state: 'failed' });
        env.controller.walkTo(Q2);
        env.fire(STATUS, { question: 'q.a', state: 'done' });
        expect([env.failures().length, env.controller.walking()]).toEqual([0, OFFICE]);
    });

    it('the next question, named while the last request is closing, waits its turn and is asked at done', () => {
        const env = setup();
        const Q1 = { kind: 'location', name: 'Question 01' };
        env.controller.setInstant(true);
        env.controller.walkTo(Q2);
        expect(env.controller.walkTo(Q2)).toBe(true); // the same target again: already being solved
        expect(env.controller.walkTo(Q1)).toBe(true); // the page sent the check; its `done` is still to come
        expect(env.asks()).toEqual([{ story: 's', question: 'q.b', instant: true }]);
        env.fire(STATUS, { question: 'q.b', state: 'done' });
        expect(env.asks()[1]).toEqual({ story: 's', question: 'q.a', instant: true });
        expect(env.controller.walking()).toBe(OFFICE);
        env.fire(STATUS, { question: 'q.a', state: 'done' });
        expect(env.controller.walking()).toBeNull();
    });

    it('a failed walk takes the one waiting behind it with it; stop tells the page and clears both', () => {
        const env = setup();
        env.controller.walkTo(Q2);
        env.controller.walkTo({ kind: 'location', name: 'Question 01' });
        env.fire(STATUS, { question: 'q.b', state: 'failed' });
        expect([env.asks().length, env.failures().length, env.controller.walking()]).toEqual([1, 1, null]);
        env.controller.walkTo(Q2);
        env.controller.walkTo({ kind: 'location', name: 'Question 01' });
        env.controller.stop();
        expect(env.asks()[2]).toEqual({ story: 's', question: 'q.b', stop: true });
        expect([env.asks().length, env.controller.walking(), env.failures().length]).toEqual([3, null, 1]);
    });
});

describe('the mystery playback controller: exits and refusals', () => {
    it('leaves the office by a named exit, through the host', () => {
        const env = setup();
        expect(env.controller.walkTo({ kind: 'exit', name: 'Down to the street' })).toBe(true);
        expect(env.moved[0].event).toBe('user:regionMove');
        expect(env.moved[0].payload).toMatchObject({ sourceRegion: OFFICE, targetRegion: 'The street', exitName: 'Down to the street' });
        expect(env.asks()).toEqual([]);
    });

    it('refuses by name, and sends nothing, what it cannot take', () => {
        const env = setup();
        expect(env.controller.walkTo({ kind: 'location', name: 'Something in the gutter' })).toBe(false);
        expect(env.controller.lastRefusal).toBe(REFUSALS.NOT_A_QUESTION);
        expect(env.controller.walkTo({ kind: 'exit', name: 'Out of the window' })).toBe(false);
        expect(env.controller.lastRefusal).toBe(REFUSALS.NO_SUCH_EXIT);
        expect(env.controller.walkTo({ kind: 'tile', x: 1, y: 1 })).toBe(false);
        expect(env.controller.lastRefusal).toBe(REFUSALS.UNKNOWN_TARGET);
        expect([env.sent, env.moved]).toEqual([[], []]);
        const away = setup({ here: 'The street' });
        expect(away.controller.walkTo(Q2)).toBe(false);
        expect(away.controller.lastRefusal).toBe(REFUSALS.NO_CASE_REGION);
    });

    it('has the whole controller surface', () => {
        const { controller } = setup();
        for (const m of ['play', 'stop', 'step', 'instant', 'reset', 'setRate', 'setInstant']) expect(() => controller[m]()).not.toThrow();
    });
});
