/**
 * procgenCore/pageLifetime — WHO OWNS THE PAGE RIGHT NOW, and what has to
 * stop when somebody else takes it.
 *
 * ⚠ TOOLING ONLY, and the same three laws as `watchViewer` / `watchSolve` /
 * `watchGenerate`: it makes no claims, gates nothing, and nothing that DOES
 * make a claim may depend on it. ⛔ NO DOM AND NO NODE IMPORTS (see
 * `atlasSource.js`): this file is on every arm's path in the browser, and it
 * is unit-tested in node, so it may reach for neither side's globals.
 *
 * ── ⛓ IT MOVED HERE IN CONSTRUCTIVE-MODE SLICE 3, AND THE REASON IS THAT
 *    THERE ARE NOW TWO LAB PAGES ───────────────────────────────────────
 *
 * It was `seedlingDemo/watchLifetime.js`, and there is not one Seedling fact in
 * it: no atlas, no tape, no palette, no engine — an AbortController, a guarded
 * loop body and a bounded history of retired arms. `mazeRoom/lab.html` has the
 * same SOURCE selector switching arms in place and therefore the same silent
 * failure mode (a second rAF chain over the first; a keydown listener from an
 * arm nobody is looking at). ⛔ The alternative was `mazeRoom/` importing
 * `seedlingDemo/`, which is the cross-substrate edge slice 2 spent its RNG
 * decision avoiding. `seedlingDemo/watchLifetime.js` is now a re-export, so no
 * Seedling caller learns the move happened.
 *
 * ⚠ It is a PAGE utility, not a LOOP one, and it sits beside the loop anyway:
 * `procgenCore/` is the neutral outer-repo home (⚖ ruling 4) and a third
 * directory for one 290-line file would be a home nobody could name. Recorded
 * so the promotion to `shared/` knows this file is not part of the generator.
 *
 * ── ⛓⛓⛓ WHY THIS EXISTS: THE RELOAD WAS THE TEARDOWN ──────────────────
 *
 * Until now the page's four SOURCE arms each mounted exactly once per
 * document, because every way of leaving one NAVIGATED — the SOURCE
 * selector, the tape picker and the boot presets all assign
 * `window.location.search`. A document teardown is a very thorough teardown:
 * it stops every rAF chain, drops every listener and forgets every closure,
 * for free and without a line of code. `populatePicker`'s own docblock says
 * so out loud — reloading "keeps both sides on one code path instead of
 * giving the JS side a teardown nobody tests".
 *
 * That is a true statement about a cost, and the cost has now been chosen:
 * switching arms in place means the page must do by hand what the reload did
 * for free. This module is that hand.
 *
 * ⛔⛔ THE FAILURE MODE IS SILENT, WHICH IS WHY THE MECHANISM IS EXPLICIT.
 * A missed teardown does not throw. It leaves a second rAF chain drawing
 * over the first, or a keydown listener from an arm nobody is looking at
 * swallowing the keystrokes of the arm they are. Both read as "the page went
 * weird", days later, in a way that looks like a rendering bug and is a
 * lifetime bug. So every loop and every listener in the page is registered
 * against a lifetime that can SAY what it stopped.
 *
 * ── THE ONE THING IT IS NOT ───────────────────────────────────────────
 *
 * ⚠ THIS IS NOT `replayGeneration`, AND THE TWO MUST NOT BE MERGED. That
 * counter answers "which REPLAY owns the canvas" and is bumped whenever a
 * newer replay supersedes an older one — including twice inside one MANUAL
 * session, when a fold replays what was just driven. A lifetime answers
 * "which ARM owns the page", and retiring one drops its keyboard listeners.
 * Merging them would mean a manual fold tore down the manual arm's own
 * keyboard mid-session: the fold's supersession is a normal event WITHIN an
 * arm's life. Two questions, two counters, and the nesting is deliberate —
 * an arm outlives the replays it starts.
 */

export class PageLifetimeError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PageLifetimeError';
    }
}

/** ⛓ The name it carried in `seedlingDemo/`, kept so no `catch` has to move. */
export { PageLifetimeError as WatchLifetimeError };

const fail = (message) => { throw new PageLifetimeError(message); };

/**
 * ONE ARM'S LIFETIME.
 *
 * @param {string} name  the arm this belongs to, as it appears in the readout
 * @param {number} generation  monotonic, so two mounts of the SAME arm are
 *        distinguishable in the readout — "solve" twice is the interesting
 *        case for a leak, and two rows both called `solve` would hide it.
 */
export function createLifetime(name, generation = 0) {
    if (typeof name !== 'string' || !name) {
        fail('pageLifetime: a lifetime needs a NAME — it is what the readout and every '
            + 'refusal identify it by, and an anonymous one turns a leak report into '
            + '"something leaked".');
    }
    const controller = new AbortController();
    /** Loops that were asked to tick after retirement, by name. */
    const stopped = [];
    /** Reports an already-retired arm tried to paint. Kept, never dropped. */
    const suppressed = [];
    const hooks = [];
    let listeners = 0;
    let retiredWhy = null;

    const alive = () => retiredWhy === null;

    return {
        name,
        generation,
        alive,
        /** For anything that wants the raw signal (`fetch`, a third-party API). */
        get signal() { return controller.signal; },

        /**
         * Register a listener that DIES WITH THE ARM.
         *
         * ⛔ EVERY `addEventListener` IN THE PAGE GOES THROUGH HERE. Not as a
         * style rule: a listener registered directly is invisible to this
         * module and therefore to the readout, so the leak witness would
         * report a clean teardown while the leak sat next to it — the
         * "graceful skip hides the surface" shape, applied to the very check
         * that is supposed to catch it. `pageLifetime.test.js` asserts the
         * absence structurally, over `watchViewer.js`'s own source, because a
         * rule nobody checks is a rule that decays at the next slice.
         *
         * ⚠ REGISTERING ON A RETIRED LIFETIME THROWS rather than quietly
         * doing nothing. `addEventListener` with an already-aborted signal is
         * a silent no-op, which would give a dead arm a listener that never
         * fires and no way to find out — a control that reports success and
         * does nothing.
         */
        on(target, type, handler, options = undefined) {
            if (!alive()) {
                fail(`pageLifetime: ${name}#${generation} is retired (${retiredWhy}) and `
                    + `cannot listen for "${type}". An aborted signal would make this a `
                    + 'silent no-op, so it is a refusal instead.');
            }
            if (!target || typeof target.addEventListener !== 'function') {
                fail(`pageLifetime: ${name}#${generation} was given a "${type}" target that `
                    + 'is not an EventTarget.');
            }
            target.addEventListener(type, handler, { ...(options ?? {}), signal: controller.signal });
            listeners += 1;
        },

        /**
         * Wrap a SELF-SCHEDULING loop body so retirement stops it.
         *
         * The page's loops re-arm from their own tail (`requestAnimationFrame`
         * at the end of `frame`, `setTimeout` at the end of the wasm poll), so
         * stopping one means the tail must not run. Wrapping the body is
         * enough: the guarded call returns before it can re-arm.
         *
         * ⛓ THE BLOCKED CALL IS RECORDED, and that is the leak witness. A
         * live loop that is retired gets blocked EXACTLY ONCE — the tick it
         * was already scheduled for — and never re-arms, so `stopped` naming
         * a loop is positive evidence that the loop was running and has now
         * stopped. An empty `stopped` list on a retired arm that owned a loop
         * is the finding: it means the loop was never guarded at all.
         *
         * ⚠ IT DOES NOT SWALLOW THROWS. Within a lifetime the loops keep
         * their own error discipline — `frame`'s unconditional re-arm after a
         * throw is R4's lesson and this wrapper leaves it exactly as it was.
         */
        guard(loopName, fn) {
            if (typeof loopName !== 'string' || !loopName) {
                fail('pageLifetime: a guarded loop needs a NAME — the readout lists what it '
                    + 'stopped, and an unnamed loop makes that list unreadable.');
            }
            return (...args) => {
                if (!alive()) {
                    if (!stopped.includes(loopName)) stopped.push(loopName);
                    return undefined;
                }
                return fn(...args);
            };
        },

        /**
         * Do something only while this arm still owns the page — and KEEP the
         * report when it does not.
         *
         * ⛔ THE STALE-CHROME HAZARD IS THE RAW TRUTH LAW IN REVERSE. A
         * retired arm's in-flight work still finishes: a fetch resolves, a
         * timeout fires, a promise rejects. If it paints into `#status` or
         * calls `fatal`, the page shows the LIVE arm a refusal belonging to a
         * dead one — a message that is true about nothing on screen.
         *
         * ⚠ AND SUPPRESSING IT SILENTLY WOULD BE THE OTHER HALF OF THE SAME
         * TRAP, so the message is kept on the lifetime and appears in the
         * readout under `suppressed`. Nothing is dropped; it is filed where
         * it is true.
         */
        report(what, fn) {
            if (!alive()) {
                suppressed.push(String(what));
                return false;
            }
            fn();
            return true;
        },

        /** Run when this arm is retired — GENERATE's ladder state, an iframe. */
        onRetire(fn) {
            if (typeof fn !== 'function') fail('pageLifetime: onRetire needs a function.');
            if (!alive()) {
                // Already dead: run it now rather than never. A hook attached
                // during teardown is a race, not a mistake, and dropping it
                // would leave exactly the resource it was meant to release.
                fn();
                return;
            }
            hooks.push(fn);
        },

        /**
         * ⚠ IDEMPOTENT, AND THE **FIRST** REASON WINS. Retiring twice is
         * normal during a teardown that cascades; the second call must not
         * overwrite why the arm actually ended with "already retired".
         */
        retire(why) {
            if (!alive()) return false;
            retiredWhy = String(why || 'no reason given');
            controller.abort();
            for (const fn of hooks.splice(0)) fn();
            return true;
        },

        /** What the page publishes for the browser row to assert on. */
        state() {
            return {
                name,
                generation,
                alive: alive(),
                retiredWhy,
                listeners,
                stopped: [...stopped],
                suppressed: [...suppressed],
            };
        },
    };
}

/**
 * THE PAGE HOLDS EXACTLY ONE LIVE ARM, and this is where that is enforced.
 *
 * ⛔ STARTING AN ARM RETIRES THE PREVIOUS ONE — the ordering is the whole
 * point and it is retire-then-create. The other order would leave a window in
 * which two arms are both alive and both believe they own the canvas, which
 * is the exact state the reload used to make unreachable.
 *
 * ⛓ RETIRED ARMS ARE KEPT (bounded), because the leak question is asked ABOUT
 * THE PAST: "did the manual arm's loop stop when I switched away from it" is
 * unanswerable from a readout that only describes the arm now running.
 */
export function createLifetimeHolder({ keep = 8, publish = null } = {}) {
    let current = null;
    let generation = 0;
    const history = [];

    /**
     * ⛔ THE HISTORY HOLDS THE LIFETIMES, NOT SNAPSHOTS OF THEM — and this
     * was MEASURED, not reasoned: the first cut pushed `current.state()` at
     * retirement and `pageLifetime.test.js`'s "keeps the retired arms" row
     * came back with an EMPTY `stopped` list.
     *
     * The reason is the whole point of the leak witness. A retired loop's one
     * blocked tick happens AFTER retirement — it is the tick that was already
     * scheduled — so a snapshot taken at retirement is taken one instant too
     * early to hold the only evidence anybody wants. ⚖ The readout-assigned-
     * from-a-getter trap, in the very list that exists to report leaks.
     */
    const snapshot = () => ({
        current: current ? current.state() : null,
        retired: history.map((lt) => lt.state()),
    });

    const announce = () => {
        if (publish) publish(snapshot());
    };

    return {
        current: () => current,
        /**
         * @param {string} name the arm taking the page
         * @param {string} [why] what caused the switch, for the retired arm's record
         */
        start(name, why = null) {
            if (current) {
                current.retire(why || `superseded by ${name}#${generation + 1}`);
                history.push(current);
                while (history.length > keep) history.shift();
            }
            generation += 1;
            current = createLifetime(name, generation);
            announce();
            return current;
        },
        /** Retire whatever is running without starting anything — page teardown. */
        retire(why) {
            if (!current) return false;
            current.retire(why);
            history.push(current);
            while (history.length > keep) history.shift();
            current = null;
            announce();
            return true;
        },
        /**
         * ⚠ RE-READ AT CALL TIME, never cached — for the RETIRED arms as much
         * as the live one (see `snapshot`). A count taken when the arm mounted
         * would report what it held before it finished mounting.
         */
        state: snapshot,
        announce,
    };
}
