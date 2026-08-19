/**
 * seedlingDemo/watchWasm — **ONE MECHANISM FOR SHIPPING WHAT THIS PAGE HOLDS
 * INTO THE REAL RECOMPILED SEEDLING**, and the stage machine that says where
 * a ship stopped.
 *
 * ── ⛓⛓⛓ WHY IT MOVED OUT OF `watchViewer.js` ─────────────────────────
 *
 * The wasm arm was `runWasm`, reachable from exactly one place: `?side=wasm`
 * with a committed `?tape=`. Everything it does — HEAD-probe the build, wait
 * for `__runtimeReady`, wait for the USER's ▶ Start, hand the game a tape,
 * poll `botStatus` — is equally what SOLVE, MANUAL and GENERATE need in order
 * to ship what THEY hold. A second copy of that sequence in the button's
 * handler would be a second opinion about which stage a ship is in and about
 * what a refusal at each one is called, in a page whose whole claim is that
 * there is one of everything.
 *
 * ⛔ SO THE REPLAY ARM IS NOW A CALLER. `?side=wasm&tape=…` reaches the same
 * `shipToWasm` the button does; what makes its behaviour byte-identical is
 * that the READOUT is an interface — REPLAY hands in one that paints the
 * shared `#status`/`#hud`/`#bar` with the exact strings it always printed,
 * and the button hands in one that paints its own block instead. A ship that
 * clobbered `#status` in SOLVE would delete the JS certification it is meant
 * to be printed BESIDE.
 *
 * ── THE STAGES ────────────────────────────────────────────────────────
 *
 *   probe     the build is SERVED (HEAD) — else `wasm-build-missing`
 *   runtime   `__runtimeReady` in the frame
 *   start     the USER pressed ▶ Start inside the frame (`botStatus` answers)
 *   levels    ONLY with a level set: `botLoadLevels` per chunk, then
 *             `botLevelSet` READ BACK and diffed against what was sent
 *   tape      `botLoadTape` returned `'ok'`
 *   running   `botStart` returned `'ok'`; the `botStatus` poll is live
 *   finished  `botStatus.finished`
 *   verdict   the END-STATE comparison, when an expectation was given
 *
 * ⛔ EVERY REFUSAL IS A NAMED STATE (trap 403): a ship that stopped and an
 * empty readout are indistinguishable otherwise, and the reader cannot tell
 * "the build is not here" from "you never pressed Start" from "the game
 * refused the tape". The stage NAMES are the vocabulary the browser rows
 * assert on, so they are frozen here rather than spelled at each call site.
 *
 * ── ⛔⛔ TWO LAWS THIS FILE ENFORCES ──────────────────────────────────
 *
 * **THE PARENT NEVER STARTS THE GAME.** `__swfBridgeStart` latches `started`
 * and hides the button, and the renderer + AudioContext consume the user
 * activation — so a parent-side click burns the one real click it was trying
 * to save and leaves no way to make another. This module asks and polls; it
 * never presses. (A Playwright row's click IS a real input event with real
 * user activation, so a ROW may do what this page may not.)
 *
 * **A SHIP IS A FRESH IFRAME.** The wasm cannot rewind — `botReset` forgets
 * the tape, not the world — so a second ship on a page that already ran one
 * would start from wherever the last one stopped and report it as data. Every
 * ship blanks the frame and waits for the blank to land before pointing it at
 * the build again.
 *
 * ── WHAT IS PURE ──────────────────────────────────────────────────────
 *
 * `stagesOf` and `verdictOf` take data and return data — no DOM, no globals,
 * no timers — so the stage machine and the end-state comparison are unit-
 * tested in node (`watchWasm.test.js`) rather than only through a browser row
 * that needs a real GPU to reach them.
 */

/**
 * The build `watch.html` ships to.
 *
 * ⛓ p4b, NOT `seedling_bot_ap`, SINCE THE WASM-HYGIENE SLICE. p4b's bridge
 * surface is a strict SUPERSET (it adds botForgeSaveStamp, botLevelSet and
 * botLoadLevels — the last two are what makes the GENERATE ship possible at
 * all), and it was MEASURED to be the same game where it counts: the R8 tape
 * gate — `verify-seedling-bot-differential.mjs --win --only=<the 20 r8-*
 * tapes>`, whose expectations are seedling_bot_ap's OWN oracle recordings —
 * reads 534 PASS / 0 FAIL / 67 SKIP on BOTH builds, and the two logs agree
 * line for line except in two free-running clocks whose control arm (the same
 * build re-run) varies at least as much. So the page loads one build instead
 * of two and the submodule pins one fewer 33 MB artifact.
 *
 * ⛔ SPELLED AS A PATH LITERAL, deliberately. `check-seedling-wasm-pins.mjs`'s
 * REFERENCED view scans tracked files for four spellings of a build name, and
 * this is spelling 1 (`wasm/<name>/`); a name composed from a variable here
 * would be invisible to it and could clear the build for retirement while this
 * page still loaded it (§18.14.5, trap 411).
 */
export const WASM_PAGE = '../flashPanel/wasm/seedling_bot_ap_p4b/game.html';

/** ⛓ The ordered stage vocabulary. The rows assert on these names. */
export const WASM_STAGES = Object.freeze([
    'probe', 'runtime', 'start', 'levels', 'tape', 'running', 'finished', 'verdict',
]);

/**
 * ── ⛓⛓⛓ THE END-STATE TOLERANCE — **MEASURED AT ZERO**, WITH ITS COMMAND ──
 *
 * Five committed tapes replayed through the JS model (`tapeRunner.runTape`)
 * and through `seedling_bot_ap_p4b` on real-GPU Windows Chrome (WEBGPU_ADAPTER
 * `intel / gen-9`), comparing the model's LAST observation against `botStatus`
 * at `finished`. Every arm finished; every level, x, y and item set was
 * **identical**, floats included:
 *
 *   friction-stop      30t  L0   x 100.50000000000001  y 136                 Δ0/Δ0
 *   collide-up-rock    45t  L0   x 88                  y 130.05              Δ0/Δ0
 *   r3-collect-shield  54t  L20  x 120                 y 59.500000000000014  Δ0/Δ0  [hasShield] both sides
 *   r7-act2-2          47t  L3   x 72                  y 24                  Δ0/Δ0  (a level TRANSITION)
 *   cross-level-leg   257t  L0   x 24                  y 136                 Δ0/Δ0
 *
 *   ⇒ MAX |Δx| = 0   MAX |Δy| = 0
 *
 * ⛔ SO THE TOLERANCE IS **0**, AND THAT IS THE MEASUREMENT RATHER THAN A ROUND
 * FIGURE. A number picked above what was measured would be a bound nothing can
 * reach (trap 355) — it would pass a real divergence in silence. At 0 a
 * non-zero delta is a FINDING, which is what this verdict is for.
 *
 * ⚠ AND IT IS A CLAIM ABOUT FIVE TAPES, NOT ABOUT THE ENGINE. `DEFAULT_TOLERANCE`
 * one module over is 1.0 px for a DIFFERENT question (the smallest arrival a
 * bot can plan for, `botDriverV1`'s quantisation note); this one is the
 * observed agreement of two implementations at one frame. If a sixth tape ever
 * shows a non-zero delta, the honest move is to publish the tape — not to widen
 * this (trap 410).
 */
export const END_STATE_TOLERANCE = 0;

/**
 * Which stages a ship with this payload will pass through.
 *
 * ⛓ `levels` is the only conditional one, and it is conditional on DATA rather
 * than on a flag: a payload with a level set mounts it, one without does not.
 * `verdict` is always present — "no expectation" is an answer, not an absence
 * (trap 262's shape), and a reader who could not see the stage at all could not
 * tell a MANUAL ship from one whose verdict was never computed.
 */
export function stagesOf({ levelSet = null } = {}) {
    return WASM_STAGES.filter((s) => s !== 'levels' || Boolean(levelSet));
}

/**
 * ── ⛓⛓⛓ THE ROOM A GENERATED LEVEL BECOMES ONCE IT IS SHIPPED ────────
 *
 * ⛔ THE JS MODEL AND THE REAL GAME NAME THE SAME ROOM DIFFERENTLY, BY
 * CONSTRUCTION. `SEEDLING_DEFAULTS.level` is **900** for every generated
 * record, and `levelSetExporter.buildLevelSet` ASSIGNS dense ids `0..N-1`
 * because a manifest needs them — so the model's last observation says
 * `level: 900` and `botStatus` says `level: 0`, and an end-state verdict that
 * compared them raw would print `disagrees (level 0≠900)` on a ship that
 * worked perfectly. That is a verdict about the two id spaces, not about the
 * run.
 *
 * ⛓ SO THE REMAP IS A FUNCTION, not a subtraction written at the call site:
 * the per-tick differential will need exactly this mapping for exactly this
 * reason, and a second derivation of it there would be two answers to "which
 * room is this". ⚖ The orchestrator's ruling, 2026-08-19.
 *
 * ⛔ AND IT REFUSES RATHER THAN GUESSING. A level that is ALREADY a room index
 * of this set passes through (a set assembled from real rooms); anything else
 * is a level this set does not contain, and mapping it to 0 would invent an
 * agreement.
 *
 * @param {number} level      the record's own level (900 for a generated room)
 * @param {number} roomCount  how many rooms the shipped set has
 * @param {number[]} order    the record levels IN SET ORDER; position is identity
 * @returns {{room:number|null, remapped:boolean, why:string|null}}
 */
export function roomOfGeneratedLevel(level, roomCount, order = null) {
    if (!Number.isInteger(roomCount) || roomCount < 1) {
        return { room: null, remapped: false, why: `a set with ${roomCount} room(s) has no rooms to map into` };
    }
    if (Array.isArray(order) && order.length) {
        const at = order.indexOf(level);
        if (at >= 0) {
            return {
                room: at,
                remapped: at !== level,
                why: at === level ? null
                    : `level remapped ${level}\u2192${at} (the generated room is room ${at} of the shipped set)`,
            };
        }
        return { room: null, remapped: false, why: `level ${level} is not in this set's order [${order.join(', ')}]` };
    }
    if (Number.isInteger(level) && level >= 0 && level < roomCount) {
        return { room: level, remapped: false, why: null };
    }
    return { room: null, remapped: false, why: `level ${level} is outside this ${roomCount}-room set and no set order was given` };
}

/** The items an expectation names, as a sorted list of the keys it holds. */
const heldItems = (items) => Object.entries(items ?? {})
    .filter(([k, v]) => v === true && k !== 'hitsMax').map(([k]) => k).sort();

/**
 * ── ⛓⛓⛓ THE END-STATE VERDICT ────────────────────────────────────────
 *
 * ⛔⛔ THIS IS NOT CERTIFICATION AND THE READOUT SAYS SO. It compares ONE
 * frame — where the real game ended against where the JS model ended — and
 * two runs can agree there while disagreeing on every tick in between. The
 * per-tick differential is a separate instrument
 * (`verify-seedling-bot-differential.mjs`) and a separate slice.
 *
 * @param {object|null} expect  `{level, x, y, items}` — the JS model's last
 *   observation of the SAME tape, or `null` when the run is the user's own
 *   (MANUAL drives the real game by hand and there is nothing to agree with).
 * @param {object|null} status  the game's `botStatus` block.
 * @param {number} tol  the positional tolerance, in pixels.
 * @returns {{kind, agrees, text, deltas}}
 */
export function verdictOf(expect, status, tol = END_STATE_TOLERANCE, opts = {}) {
    const { noExpectWhy = null, refusal = null } = opts;
    /**
     * ⛔ "NOT FINISHED" IS ASKED FIRST, because an unfinished status still
     * carries an x, a y and a level — comparing them would produce a
     * confident `disagrees` about a run that simply had not got there yet,
     * which is the worst of the three answers to be wrong about.
     *
     * ⛓ AND IT CARRIES THE REFUSAL'S OWN REASON when there is one, because
     * "not finished" without it is the empty readout this whole design exists
     * to refuse (trap 403): the reader cannot tell a missing build from an
     * unpressed ▶ Start from a tape the game rejected.
     */
    if (!status || status.finished !== true) {
        return {
            kind: 'not-finished',
            agrees: null,
            deltas: null,
            text: refusal ? `not finished (${refusal.reason})` : 'not finished',
        };
    }
    if (!expect) {
        return {
            kind: 'none',
            agrees: null,
            deltas: null,
            text: noExpectWhy ? `no expectation (${noExpectWhy})` : 'no expectation',
        };
    }
    const dx = Math.abs(Number(status.x) - Number(expect.x));
    const dy = Math.abs(Number(status.y) - Number(expect.y));
    const want = heldItems(expect.items);
    const got = heldItems(status.items);
    const missing = want.filter((k) => !got.includes(k));
    const why = [];
    if (status.level !== expect.level) why.push(`level ${status.level}\u2260${expect.level}`);
    if (!(dx <= tol)) why.push(`x \u0394${dx} > ${tol}`);
    if (!(dy <= tol)) why.push(`y \u0394${dy} > ${tol}`);
    // ⛔ SUPERSET, not equality: the real game may hold items the segment's own
    // staging granted and the model's last frame reports the same way, but a
    // game that is MISSING something the model collected is the finding.
    if (missing.length) why.push(`missing ${missing.join('+')}`);
    return {
        kind: why.length ? 'disagrees' : 'agrees',
        agrees: why.length === 0,
        deltas: { dx, dy, level: status.level, expectedLevel: expect.level, missing },
        text: why.length ? `disagrees (${why.join('; ')})` : 'agrees',
    };
}

/** One line for the ledger/readout, with the bound this verdict is NOT. */
export const verdictLine = (v) => `wasm verdict: ${v.text}`;

/** ⛓ Said everywhere the verdict is, because it is the whole of its limit. */
export const VERDICT_SCOPE =
    'end state only; the per-tick differential is the next slice';

/**
 * ⛓ THE READBACK COMPARISON — the proof a set MOUNTED rather than merely
 * arrived (`check-seedling-generated-set.mjs`'s own law).
 *
 * ⛔ IT NAMES THE FIELD. "the readback disagrees" is a sentence nobody can act
 * on; `active watch-oneroom-e5c2cdf3 ≠ watch-oneroom-4ac90eaa` says the set
 * that mounted is a different set, and `table_levels 0 ≠ 1` says the delivery
 * never landed. `set_id` carries the content hash (`stampLevelSetIdentity`), so
 * comparing it compares the bytes.
 *
 * @returns {string|null} the first disagreement, or null
 */
export function levelSetDisagreement(sent, back) {
    if (!back) return 'botLevelSet answered nothing — the VM is dead or this build has no accessor';
    if (back.error) return `the artifact recorded a level-set error: ${JSON.stringify(back.error)}`;
    if (back.active !== sent.set_id) return `active ${back.active} ≠ ${sent.set_id}`;
    if (back.table_levels !== sent.rooms.length) {
        return `table_levels ${back.table_levels} ≠ ${sent.rooms.length}`;
    }
    if (back.start_level !== sent.start.level) {
        return `start_level ${back.start_level} ≠ ${sent.start.level}`;
    }
    return null;
}

/**
 * ── ⛓⛓⛓ SHIP IT ──────────────────────────────────────────────────────
 *
 * @param {object} payload
 * @param {object|null} payload.levelSet  a validated set to mount first
 * @param {Array<object>|null} payload.chunks  its delivery chunks
 * @param {object} payload.tape           the tape the game will run
 * @param {object|null} payload.expect    the JS model's end state, or null
 * @param {string|null} payload.expectWhy why there is none (`manual`), for the
 *   verdict's own words — an absence with a reason beside it
 * @param {string} payload.label          what is being shipped, for the readout
 * @param {string|null} payload.note      a one-line fact the readout prints beside
 *   the verdict (the GENERATE ship's level remap)
 * @param {object} host
 * @param {HTMLIFrameElement} host.frame
 * @param {object} host.lifetime          the arm's lifetime (guards + teardown)
 * @param {object} host.readout           `{onStage, onRefusal, onTick, onVerdict}`
 * @param {number} [host.tolerance]
 * @returns {Promise<object>} the ship's final state — also what the readout was
 *   told, so a caller has it without scraping the DOM.
 */
export async function shipToWasm(payload, host) {
    const {
        levelSet = null, chunks = null, tape, expect = null, expectWhy = null, label = '',
        note = null,
    } = payload;
    const { frame, lifetime, readout, tolerance = END_STATE_TOLERANCE } = host;
    const state = {
        stage: null,
        stages: stagesOf({ levelSet }),
        reached: [],
        refusal: null,
        label,
        /**
         * ⛓ A ONE-LINE FACT THE CALLER KNOWS AND THIS MODULE CANNOT: the
         * GENERATE ship REMAPS its expectation's level (900 → room 0), and a
         * verdict printed without that sentence beside it is a number the
         * reader cannot audit. ⛔ It is carried, never composed here — the
         * caller owns the reason it exists.
         */
        note,
        status: null,
        verdict: null,
        set: levelSet ? { set_id: levelSet.set_id, rooms: levelSet.rooms.length } : null,
    };
    const enter = (stage, message) => {
        state.stage = stage;
        state.reached.push(stage);
        readout.onStage(stage, message, state);
    };
    const refuse = (stage, reason, detail = '') => {
        state.stage = stage;
        state.refusal = { stage, reason, detail };
        /**
         * ⛓ A REFUSAL HAS A VERDICT TOO, and it is `not finished (<reason>)`.
         * A ship that stopped leaves `verdict: null` otherwise, which reads
         * identically to one nobody asked about — and the whole point of the
         * stage machine is that the reader can tell those apart.
         */
        state.verdict = verdictOf(expect, null, tolerance,
            { noExpectWhy: expectWhy, refusal: state.refusal });
        readout.onRefusal(stage, reason, detail, state);
        readout.onVerdict(state.verdict, state);
        return state;
    };

    // ── probe ────────────────────────────────────────────────────────
    const probe = await fetch(WASM_PAGE, { method: 'HEAD' }).catch(() => null);
    if (!probe || !probe.ok) {
        return refuse('probe', 'wasm-build-missing',
            `${WASM_PAGE} is missing (HTTP ${probe ? probe.status : 'unreachable'}). `
            + 'Run `git submodule update --init '
            + 'frontend/modules/flashPanel/wasm`. Use &side=js meanwhile.');
    }
    /**
     * ── ⛔⛔ THE FRAME IS POINTED AT THE BUILD **BEFORE** THE STAGE IS
     * ── ANNOUNCED, AND A ROW CAUGHT ME GETTING THAT BACKWARDS ────────
     *
     * The lift's first cut announced `probe` first and blanked the frame after.
     * `check-seedling-wasm-pages.mjs` settles on the first readout matching
     * /missing|runtime|ready|click/ — and *"loading the runtime…"* matches — so
     * it read the page during the blank and found `frame.src = about:blank`.
     * FAIL, on a claim that had passed for two slices.
     *
     * ⛓ AND THE ROW WAS RIGHT. The old code set `frame.src` and the status in
     * one synchronous block, so *"loading the runtime…"* MEANT the frame is
     * pointed at the build. Announcing it a navigation early is a readout
     * describing a state the page has not entered yet — the page's own RAW
     * TRUTH law, and precisely the class of defect a lift can introduce while
     * every line still looks familiar. ⇒ the frame moves first.
     */
    await freshFrame(frame, lifetime);
    /**
     * ⛓⛓ THE TEARDOWN THE RELOAD USED TO DO. `about:blank` discards the
     * frame's document, and with it the runtime, its rAF chain and its audio.
     * That is the whole of the wasm side's claim on a page reload, and it is
     * satisfiable from here.
     */
    lifetime.onRetire(() => {
        frame.src = 'about:blank';
        frame.style.display = 'none';
    });
    enter('probe', 'the build is served');

    const win = () => frame.contentWindow;
    const bot = (name, arg) => {
        const g = win() && win().__swfBridge && win().__swfBridge.game;
        if (!g || typeof g[name] !== 'function') return null;
        return arg === undefined ? g[name]() : g[name](arg);
    };
    const botJson = (name, arg) => {
        const raw = bot(name, arg);
        try { return raw ? JSON.parse(raw) : null; } catch { return null; }
    };
    /**
     * ⚠ A THREE-MINUTE POLL IS A LOOP WITH A LONG FUSE. Retired, it would go
     * on asking a discarded iframe for `__runtimeReady` every 200 ms and then
     * TIME OUT under some other arm, painting a wasm refusal over whatever
     * that arm had drawn. So the chain stops with the lifetime, and the
     * promise REJECTS rather than hanging: an `await` nobody will ever
     * resolve is a leak that looks like a slow load.
     */
    const until = (what, pred, ms = 180000) => new Promise((resolve, reject) => {
        const t0 = Date.now();
        const tick = lifetime.guard('wasm-until', () => {
            let v = null;
            try { v = pred(); } catch { v = null; }
            if (v) return resolve(v);
            if (Date.now() - t0 > ms) return reject(new Error(`timed out waiting for ${what}`));
            return setTimeout(tick, 200);
        });
        lifetime.onRetire(() => reject(new Error(
            `the wasm arm was retired while waiting for ${what}`)));
        tick();
    });

    // ── runtime ──────────────────────────────────────────────────────
    try {
        await until('__runtimeReady', () => win() && win().__runtimeReady);
    } catch (e) {
        return refuse('runtime', 'runtime-never-ready', e.message);
    }
    enter('runtime', 'the runtime is up');

    // ── start ────────────────────────────────────────────────────────
    //
    // ⚠⚠ THE PARENT MUST NOT START THE GAME. NOT EVEN AS A FALLBACK.
    //
    // The frame's start path is
    //     __swfBridgeStart = function () {
    //         if (started || !__runtimeReady) return false;
    //         started = true;
    //         btn.style.display = 'none';
    //         Module.ccall('runSWF', ...);
    //     }
    // and its own comment says it "MUST run within a user-gesture handler in
    // this document (WebGPU renderer init + AudioContext consume the
    // activation)".
    //
    // A first cut called `btn.click()` from the parent as a harmless-looking
    // convenience. It is not harmless: it LATCHES `started = true` and HIDES
    // the button, so `runSWF` is invoked with no user activation (the
    // renderer never comes up, `game.botStatus` never appears) AND the user's
    // real click is now impossible — the button is gone and the latch refuses
    // a second start. It burns the one chance it was trying to save. The
    // symptom is maximally unhelpful: `__swfBridge.game` exists, so the shim
    // looks fine, and the wait just spins.
    //
    // So the parent does exactly nothing here except ask, and poll.
    readout.onStage('start', 'waiting for ▶ Start inside the frame', state);
    try {
        await until('the game\'s bot callbacks (press Start in the frame)',
            () => bot('botStatus') !== null);
    } catch (e) {
        return refuse('start', 'start-never-pressed', `${e.message}. The frame is up but `
            + 'the SWF has not begun, which is what a missed Start looks like.');
    }
    state.stage = 'start';
    state.reached.push('start');

    // ── levels ───────────────────────────────────────────────────────
    if (levelSet) {
        try {
            for (const chunk of chunks ?? []) {
                const said = bot('botLoadLevels', JSON.stringify(chunk));
                if (said !== 'ok') throw new Error(`botLoadLevels: ${said}`);
            }
        } catch (e) {
            return refuse('levels', e.message,
                `${(chunks ?? []).length} chunk(s) for ${levelSet.set_id}`);
        }
        /**
         * ⛔ THE READBACK IS THE POINT. Reading state back out of the artifact
         * is the only check that does not share the producer's assumptions —
         * Phase 3b's manifest gate caught `new Array(45)` this way, a defect
         * no tape and no unit test could see because both read the same wrong
         * object.
         */
        const back = botJson('botLevelSet');
        const why = levelSetDisagreement(levelSet, back);
        if (why) return refuse('levels', 'set-readback-disagrees', why);
        state.readback = back;
        enter('levels', `${levelSet.rooms.length} room(s) mounted — ${levelSet.set_id}`);
    }

    // ── tape ─────────────────────────────────────────────────────────
    const loaded = bot('botLoadTape', JSON.stringify(tape));
    if (loaded !== 'ok') return refuse('tape', `botLoadTape: ${loaded}`, '');
    enter('tape', 'the game accepted the tape');

    // ── running ──────────────────────────────────────────────────────
    const started = bot('botStart');
    if (started !== 'ok') return refuse('running', `botStart: ${started}`, '');
    enter('running', `${label} — running in the real game`);

    /**
     * ⚠ THE WRAPPER CALLS `poll` THROUGH AN ARROW rather than wrapping it
     * directly: `poll` is hoisted and readable here, but only from inside a
     * body that runs later.
     */
    const pollTick = lifetime.guard('wasm-poll', () => poll());
    // A function DECLARATION, not a const arrow: `poll()` is called above this
    // line and a `const` would be in its temporal dead zone. Caught by the
    // real-GPU Windows run, which is the only place the wasm path gets far
    // enough to execute it.
    function poll() {
        const st = botJson('botStatus');
        if (st) {
            state.status = st;
            readout.onTick(st, tape, state);
            if (st.finished) {
                state.stage = 'finished';
                state.reached.push('finished');
                const v = verdictOf(expect, st, tolerance, { noExpectWhy: expectWhy });
                state.verdict = v;
                state.stage = 'verdict';
                state.reached.push('verdict');
                readout.onVerdict(v, state);
                return;
            }
        }
        setTimeout(pollTick, 250);
    }
    pollTick();
    return state;
}

/**
 * ⛓ A FRESH DOCUMENT IN THE FRAME, AND THE WAIT IS THE POINT.
 *
 * Assigning `about:blank` and the build in the same turn coalesces into one
 * navigation, so the second ship would inherit the first one's runtime — the
 * exact thing "a ship is a fresh iframe" exists to prevent, and it would look
 * like a working ship reporting somebody else's end state. The blank has to
 * LAND first, which is a `load` event.
 */
function freshFrame(frame, lifetime) {
    return new Promise((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        lifetime.on(frame, 'load', function once() { finish(); }, { once: true });
        frame.src = 'about:blank';
        // ⚠ A BOUNDED WAIT, never an unbounded one: a frame that is ALREADY
        // blank may not fire `load` at all, and a ship that hung here would be
        // indistinguishable from a build that would not serve.
        setTimeout(finish, 500);
    }).then(() => {
        frame.src = WASM_PAGE;
        frame.style.display = 'block';
    });
}
