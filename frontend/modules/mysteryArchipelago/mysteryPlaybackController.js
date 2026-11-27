/**
 * The Playback Bot's controller for a `mystery` region (the registry's `getPlaybackController`).
 *
 * ⚖ Robert, 2026-11-27: the bot drives the PAGE. A walk to a question's location asks the game's
 * page for its careful reader on that one question (`mystery:autoSolve {story, question}`); the
 * page reads, links and answers on its own timeline and sends the solved question as it always
 * does, which the bridge turns into the check the bot is waiting for. Play asks at the page's
 * pace; Instant asks for the question in one burst (`instant: true`); the bot says which with
 * `setInstant` before its first target. A walk to an exit leaves the
 * office through the host, since the page knows nothing of the world around the case.
 *
 * The page must be open to be driven: a walk opens the Mystery Game panel when the page has not
 * asked for a state yet, and waits for it. While a walk is in flight `walking()` names its region,
 * and the bridge then tells the page it is in the office (`inOffice`), so a lock, or loop mode's
 * park rule, does not stop the reader the bot itself asked for.
 *
 * A walk the page cannot do ends by name, never as a silent wait: the page's own word (`failed`,
 * `stopped`, or `waiting` that does not clear), no page, or no answer at all, each published as
 * `playback:walkFailed`.
 *
 * Pure: every dependency is handed in (index.js installs the live one), so it runs in node.
 */
import { PLAYBACK_WALK_FAILED_EVENT } from '../procgenCore/playbackEvents.js';

export const MYSTERY_AUTO_SOLVE_EVENT = 'mystery:autoSolve';
export const MYSTERY_AUTO_SOLVE_STATUS_EVENT = 'mystery:autoSolveStatus';

export const MYSTERY_WALK_REFUSALS = Object.freeze({
    NO_CASE_REGION: 'the player is not in a region that is a mystery case',
    NOT_A_QUESTION: 'the location is not a question of this case',
    NO_SUCH_EXIT: 'the region has no such exit',
    UNKNOWN_TARGET: 'a mystery case has only locations and exits to walk to',
});

/** Why an accepted walk ended without its question solved (`playback:walkFailed`'s `reason`). */
export const MYSTERY_WALK_FAILURES = Object.freeze({
    NO_PAGE: 'the mystery page did not open',
    NO_ANSWER: 'the mystery page did not answer the request',
    PAGE_FAILED: 'the mystery page\'s careful reader failed',
    PAGE_STOPPED: 'the mystery page\'s careful reader was stopped',
    PAGE_WAITING: 'the mystery page\'s careful reader is waiting for a paper',
});

export const MYSTERY_WALK_TIMINGS = Object.freeze({
    /** How long a walk waits for the page to open and ask for a state. */
    pageMs: 30000,
    /** How long a walk waits for the page's first word on a request. */
    answerMs: 10000,
    /** How long a `waiting` may last before the walk gives up (a paper's state may be on its way). */
    waitingMs: 10000,
});

/** The region an exit entry of a deserialised world leads to. */
function exitTarget(exit) {
    return exit?.targetRegion ?? exit?.target_region ?? exit?.connected_region ?? exit?.to ?? null;
}

/**
 * The page's `waiting` list in words: each question with the papers (and questions) each of its ways still lacks,
 * e.g. `q.bell (papers rowe)`. Entries may be bare question ids (an older page).
 */
export function describeWaiting(waiting) {
    if (!Array.isArray(waiting) || waiting.length === 0) return undefined;
    return waiting.map((w) => {
        if (typeof w === 'string') return w;
        const ways = (Array.isArray(w?.ways) ? w.ways : []).map((way) => [
            ...(way?.papers?.length ? [`papers ${way.papers.join(', ')}`] : []),
            ...(way?.requires?.length ? [`questions ${way.requires.join(', ')}`] : []),
        ].join('; ')).filter(Boolean);
        return `${w?.question ?? '?'}${ways.length ? ` (${ways.join(' | ')})` : ''}`;
    }).join(', ');
}

/**
 * @param {Object} deps
 * @param {{publish: Function}} deps.dispatcher - the module's dispatcher (the exit move)
 * @param {{publish: Function, subscribe: Function}} deps.eventBus - the module's event bus
 * @param {() => Array<{regionId: string, payload: Object}>} deps.getCaseRegions
 * @param {() => string|null} deps.getActiveRegionId
 * @param {() => boolean} deps.pageHasAsked - has the page asked for a state (so that it is there to be driven)?
 * @param {() => void} deps.openPanel - bring the Mystery Game panel up
 * @param {() => void} [deps.onWalkingChanged] - the answer of `walking()` changed (the bridge re-sends its state)
 * @param {string} deps.substrateId
 * @param {Object} [deps.timings] - overrides of `MYSTERY_WALK_TIMINGS`
 * @param {string} deps.sourceModule - the `sourceModule` the exit move carries
 * @param {{setTimeout: Function, clearTimeout: Function}} [deps.clock]
 */
export function createMysteryPlaybackController({
    dispatcher, eventBus, getCaseRegions, getActiveRegionId, pageHasAsked, openPanel, onWalkingChanged = () => {},
    substrateId, sourceModule, timings = {}, clock = globalThis,
}) {
    const T = { ...MYSTERY_WALK_TIMINGS, ...timings };
    let instantMode = false;
    /** The walk in flight: `{target, regionId, story, question, instant, timer, asked}`. One at a time. */
    let walk = null;
    /** The target named while a walk was still closing: `{target, instant}`. */
    let next = null;

    const clearTimer = () => {
        if (walk?.timer != null) clock.clearTimeout(walk.timer);
        if (walk) walk.timer = null;
    };
    const setTimer = (ms, fn) => {
        clearTimer();
        if (walk) walk.timer = clock.setTimeout(fn, ms);
    };
    const end = () => {
        clearTimer();
        walk = null;
        const queued = next;
        next = null;
        // The target that waited its turn; with none, the bridge is told the walk is over.
        if (queued && controller.walkTo(queued.target, { instant: queued.instant })) return;
        onWalkingChanged();
    };
    const fail = (reason, detail) => {
        if (!walk) return;
        const { target } = walk;
        next = null; // a walk that failed takes the one waiting behind it with it: the bot stops on the failure
        end();
        eventBus.publish(PLAYBACK_WALK_FAILED_EVENT, { substrate: substrateId, target, reason: detail ? `${reason}: ${detail}` : reason });
    };
    /** Ask the page for the question, and wait for its first word. */
    const ask = () => {
        if (!walk) return;
        walk.asked = true;
        eventBus.publish(MYSTERY_AUTO_SOLVE_EVENT, {
            story: walk.story, question: walk.question, ...(walk.instant ? { instant: true } : {}),
        });
        setTimer(T.answerMs, () => {
            // No word at all: the page that once asked may be gone (its panel closed). Open it and ask once more
            // when it asks for a state; a second silence is the end.
            if (!walk || walk.retried) return fail(MYSTERY_WALK_FAILURES.NO_ANSWER);
            walk.retried = true;
            walk.asked = false;
            walk.waitingForPage = true;
            openPanel();
            setTimer(T.pageMs, () => fail(MYSTERY_WALK_FAILURES.NO_ANSWER));
            return undefined;
        });
    };

    // The page asked for a state: it is there. A walk that was waiting for it goes on.
    eventBus.subscribe('mystery:requestState', () => { if (walk && !walk.asked && walk.waitingForPage) ask(); });
    eventBus.subscribe(MYSTERY_AUTO_SOLVE_STATUS_EVENT, (status) => {
        if (!walk || !walk.asked) return;
        // A status that names another question belongs to another request.
        if (status?.question !== undefined && status.question !== walk.question) return;
        const state = status?.state;
        if (state === 'done') {
            // The check itself came (or comes) as the page's solved question; nothing more to do here.
            end();
        } else if (state === 'running') {
            clearTimer();
        } else if (state === 'waiting') {
            setTimer(T.waitingMs, () => fail(MYSTERY_WALK_FAILURES.PAGE_WAITING, describeWaiting(status.waiting)));
        } else if (state === 'failed') {
            fail(MYSTERY_WALK_FAILURES.PAGE_FAILED, typeof status.failed === 'string' ? status.failed : undefined);
        } else if (state === 'stopped') {
            fail(MYSTERY_WALK_FAILURES.PAGE_STOPPED, status.locked ? 'the page is locked' : undefined);
        }
    });

    const controller = {
        lastRefusal: null,
        // The bot's clock commands. They follow a target and say nothing of the pace here: the bot's Instant
        // run falls back to `step`/`play` between regions, and that must not slow the page down.
        play() {},
        step() {},
        instant() {},
        /** The pace, which the bot names before its first target: Instant asks for each question in one burst. */
        setInstant(on) { instantMode = on === true; },
        setRate() {},
        stop() {
            next = null;
            if (!walk) return;
            const { story, question, asked } = walk;
            end();
            if (asked) eventBus.publish(MYSTERY_AUTO_SOLVE_EVENT, { story, question, stop: true });
        },
        reset() {
            controller.stop();
            instantMode = false;
            controller.lastRefusal = null;
        },

        /** The region whose question the bot is having the page solve, or null. */
        walking() { return walk?.regionId ?? null; },

        /** @param {{kind: string, name?: string}} target @returns {boolean} false when the target cannot be taken */
        walkTo(target, { instant = instantMode } = {}) {
            controller.lastRefusal = null;
            const refuse = (reason) => { controller.lastRefusal = reason; return false; };
            const here = getActiveRegionId();
            const region = (getCaseRegions() ?? []).find((r) => r.regionId === here);
            if (!region) return refuse(MYSTERY_WALK_REFUSALS.NO_CASE_REGION);
            if (target?.kind === 'location') {
                const question = Object.entries(region.payload?.ap_locations ?? {}).find(([, name]) => name === target.name)?.[0];
                if (question === undefined) return refuse(MYSTERY_WALK_REFUSALS.NOT_A_QUESTION);
                if (walk) {
                    // The same target again (the bot re-issues a walk on an event): it is already being solved.
                    if (walk.question === question && walk.regionId === here) return true;
                    // The next one: the page sends a solved question BEFORE it says done, so the bot, which goes
                    // on at the check, names its next target while the last request is still closing. It waits
                    // its turn (one, the latest), and is asked when the page has said its last word.
                    next = { target, instant };
                    return true;
                }
                walk = { target, regionId: here, story: region.payload.story, question, instant: !!instant, timer: null, asked: false };
                // Before the request: the page must be told it is in the office.
                onWalkingChanged();
                if (pageHasAsked()) {
                    ask();
                } else {
                    walk.waitingForPage = true;
                    openPanel();
                    setTimer(T.pageMs, () => fail(MYSTERY_WALK_FAILURES.NO_PAGE));
                }
                return true;
            }
            if (target?.kind === 'exit') {
                const exits = region.payload?.exits;
                const exit = exits instanceof Map ? exits.get(target.name) : null;
                const to = exitTarget(exit);
                if (!to) return refuse(MYSTERY_WALK_REFUSALS.NO_SUCH_EXIT);
                dispatcher.publish('user:regionMove', {
                    sourceRegion: here, targetRegion: to, exitName: target.name, sourceModule, originator: 'PlaybackBot', fromBot: true,
                }, { initialTarget: 'bottom' });
                return true;
            }
            return refuse(MYSTERY_WALK_REFUSALS.UNKNOWN_TARGET);
        },

        /**
         * A loops Bot block's act. Always in one burst: a block is paid for in mana, not in time, and a
         * coarse substrate's Bot block has no Instant toggle of its own (`botHonorsInstant`).
         */
        perform(target) { return controller.walkTo(target, { instant: true }); },
    };
    return controller;
}
