/**
 * watchWasm.test — **THE STAGE MACHINE AND THE END-STATE VERDICT, AS PURE
 * FUNCTIONS.**
 *
 * ⛔ NO DOM. `shipToWasm` needs an iframe, a lifetime and a real recompiled
 * game, and the browser rows drive it (`check-seedling-editor-switch.mjs` for
 * the button, `check-seedling-wasm-pages.mjs` for the ship). What is asserted
 * HERE is everything that decides what a ship MEANS: which stages a payload
 * passes through, what a verdict says, which room a generated level becomes,
 * and when a readback disagrees.
 *
 * ⛓ THAT SPLIT IS THE POINT. The verdict is the one thing on this page that
 * makes a claim about the real game, and a claim reachable only through a
 * 180-second wasm boot on a machine with a GPU is a claim nobody re-runs.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { gameVisibleTape } from './tapeFormat.js';
import { loadTape } from './fixtures/index.js';
import {
    BOOT_COST_FRAMES,
    END_STATE_TOLERANCE, lastObservationOf, levelSetDisagreement, PER_TICK_SCOPE,
    perTickVerdictOf, remapStreamRooms, roomOfGeneratedLevel, stagesOf, VERDICT_SCOPE,
    verdictBlock, verdictLine, verdictOf, WASM_PAGE, WASM_STAGES, concatDrains,
    continuationTape,
} from './watchWasm.js';
import { LOAD_FADE_FRAMES } from './gameClock.js';
import { BOOT_PRESWAP_FRAMES } from './r7Acceptance.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const source = (name) => readFileSync(join(HERE, name), 'utf8');

/** A `botStatus` block, in the shape the game really answers with. */
const status = (over = {}) => ({
    tick: 166, level: 0, x: 88, y: 130.05, finished: true,
    dead_frames: 18, receive_input: true, saw_input_refused: false,
    items: { hasSword: true, hitsMax: 3 }, grants: [], ...over,
});
/** The JS model's last observation, in `expectFromFrames`' shape. */
const expected = (over = {}) => ({
    level: 0, x: 88, y: 130.05, items: { hasSword: true, hitsMax: 3 }, ...over,
});

describe('the stage vocabulary', () => {
    it('names the nine stages in the order a ship reaches them', () => {
        // ⛓ `drain` landed between `finished` and `verdict` with the per-tick
        // slice: `botDrain` is read ONCE, after the run ends, and the verdict
        // is computed from what it handed over.
        expect(WASM_STAGES).toEqual([
            'probe', 'runtime', 'start', 'levels', 'tape', 'running', 'finished', 'drain',
            'verdict',
        ]);
    });

    it('⛓ `drain` sits AFTER `finished` and BEFORE `verdict`, always', () => {
        const s = stagesOf({});
        expect(s.indexOf('drain')).toBe(s.indexOf('finished') + 1);
        expect(s.indexOf('verdict')).toBe(s.indexOf('drain') + 1);
        expect(stagesOf({ levelSet: { set_id: 'x', rooms: [{}] } })).toContain('drain');
    });

    it('⛓ `levels` appears ONLY when a level set is being shipped', () => {
        expect(stagesOf({})).not.toContain('levels');
        expect(stagesOf({ levelSet: { set_id: 'x', rooms: [{}] } })).toContain('levels');
    });

    it('⛔ `verdict` is ALWAYS a stage — "no expectation" is an answer, not an absence', () => {
        // trap 262's shape at the stage level: a reader who could not see the
        // stage could not tell a MANUAL ship from one whose verdict never ran.
        expect(stagesOf({})).toContain('verdict');
        expect(stagesOf({ levelSet: { set_id: 'x', rooms: [{}] } })).toContain('verdict');
    });

    it('⛔ the build is spelled as a literal path, so the pin gate can SEE it', () => {
        // §18.14.5: the gate's REFERENCED view scans for `wasm/<name>/`, and a
        // name composed from a variable is invisible to it — which would clear
        // a build for retirement while this page still loaded it (trap 411).
        expect(WASM_PAGE).toBe('../flashPanel/wasm/seedling_bot_ap_p4b/game.html');
    });
});

describe('verdictOf — the END-STATE comparison', () => {
    it('agrees when the level, the position and the items all match', () => {
        const v = verdictOf(expected(), status(), END_STATE_TOLERANCE);
        expect(v.kind).toBe('agrees');
        expect(v.agrees).toBe(true);
        expect(v.text).toBe('agrees');
    });

    it('⛓ M-verdict: a level ONE OFF disagrees, and the sentence names both', () => {
        const v = verdictOf(expected(), status({ level: 3 }), END_STATE_TOLERANCE);
        expect(v.agrees).toBe(false);
        expect(v.text).toBe('disagrees (level 3≠0)');
    });

    it('⛓ M-verdict: a position AT the tolerance agrees and at tol+1 does not', () => {
        // ⛔ The tolerance is MEASURED at 0 (§18.15), so this row exercises it
        // at a non-zero value too — a check that only ever saw 0 would not
        // notice a comparison written as `<` instead of `<=`.
        expect(verdictOf(expected(), status({ x: 88 + 2 }), 2).agrees).toBe(true);
        const over = verdictOf(expected(), status({ x: 88 + 3 }), 2);
        expect(over.agrees).toBe(false);
        expect(over.text).toBe('disagrees (x Δ3 > 2)');
        expect(verdictOf(expected(), status({ y: 130.05 + 1 }), 0).agrees).toBe(false);
    });

    it('⛔ items are a SUPERSET test — extra held items are not a disagreement', () => {
        const richer = status({ items: { hasSword: true, hasShield: true, hitsMax: 3 } });
        expect(verdictOf(expected(), richer, 0).agrees).toBe(true);
        const poorer = status({ items: { hitsMax: 3 } });
        expect(verdictOf(expected(), poorer, 0).text).toBe('disagrees (missing hasSword)');
    });

    it('⛔ NOT FINISHED is asked FIRST — an unfinished run gets no positional verdict', () => {
        // An unfinished status still carries x, y and a level; comparing them
        // would print a confident `disagrees` about a run that had not got
        // there yet.
        const v = verdictOf(expected(), status({ finished: false, level: 3, x: 999 }), 0);
        expect(v.kind).toBe('not-finished');
        expect(v.agrees).toBe(null);
        expect(v.text).toBe('not finished');
    });

    it('⛓ …and it CARRIES the refusal\'s reason when the ship named one', () => {
        const v = verdictOf(expected(), null, 0,
            { refusal: { stage: 'probe', reason: 'wasm-build-missing' } });
        expect(v.text).toBe('not finished (wasm-build-missing)');
    });

    it('⛓ no expectation is an ANSWER, and it says whose run it is', () => {
        expect(verdictOf(null, status(), 0).text).toBe('no expectation');
        expect(verdictOf(null, status(), 0, { noExpectWhy: 'manual' }).text)
            .toBe('no expectation (manual)');
    });

    it('⛔ the SCOPE is a constant this file owns — a verdict is END STATE ONLY', () => {
        expect(VERDICT_SCOPE).toMatch(/end state only/);
        // ⚠ It used to say "the per-tick differential is the next slice". It
        // landed, so the sentence had to stop promising it and start bounding
        // what the END-STATE line alone can mean (trap 354's family: a constant
        // whose words outlive the state they described).
        expect(VERDICT_SCOPE).toMatch(/disagreed on every tick between/);
        expect(verdictLine(verdictOf(expected(), status(), 0))).toBe('wasm verdict: agrees');
    });

    it('the measured tolerance is ZERO, and it is the DEFAULT', () => {
        // §18.15: five committed tapes, both sides, max |Δx| = max |Δy| = 0.
        // A tolerance above what was measured is a bound nothing can reach.
        expect(END_STATE_TOLERANCE).toBe(0);
        expect(verdictOf(expected(), status({ x: 88.5 })).agrees).toBe(false);
    });

    /**
     * ── ⛓⛓⛓ THE FRAME THE END STATE IS ABOUT — arc 5, slice 0 ─────────
     *
     * ⛔ THE NUMBERS BELOW ARE THE MEASURED ONES, not invented ones. Seed 38,
     * post-sword, a generated room with a CERTIFIED KILL GATE, its 360-tick
     * certification tape shipped through ▶ load in wasm: 361 drained
     * observations, every one agreeing with the JS model, and `botStatus`
     * reporting a position 1.4987×/1.4988× the model's own last step BEYOND the
     * stream's last frame — pure coasting, because the game keeps simulating
     * after a replay ends and `botStatus` is a LIVE read.
     */
    const MODEL_LAST = { x: 131.2235153194668, y: 105.234587921385, level: 0 };
    const GAME_POLL = { x: 133.00921415423176, y: 106.59101527875195 };

    it('⛓⛓⛓ the END STATE compares the DRAINED frame, not the live `botStatus`', () => {
        const expectEnd = expected({ ...MODEL_LAST });
        const live = status({ ...GAME_POLL, level: 0 });
        // the old behaviour, kept as the CONTROL: the live poll disagrees…
        const drifted = verdictOf(expectEnd, live, END_STATE_TOLERANCE);
        expect(drifted.agrees).toBe(false);
        expect(drifted.frameSource).toBe('botStatus');
        expect(drifted.text).toMatch(/x Δ1\.7856988347649576 > 0/);
        // …and the drained frame, which is what the per-tick check compares,
        // agrees exactly.
        const v = verdictOf(expectEnd, live, END_STATE_TOLERANCE,
            { finalFrame: { t: 360, ...MODEL_LAST } });
        expect(v.agrees).toBe(true);
        expect(v.frameSource).toBe('drain');
        expect(v.deltas.dx).toBe(0);
        expect(v.deltas.dy).toBe(0);
    });

    it('⛔ …and the drained frame is BELIEVED even when the live poll would agree', () => {
        // The other direction, so the row cannot pass by ignoring `finalFrame`:
        // a status that matches beside a drained frame that does not must
        // DISAGREE. A check that only ever saw the first direction would pass
        // on an implementation that quietly kept using `status`.
        const v = verdictOf(expected(), status(), END_STATE_TOLERANCE,
            { finalFrame: { t: 166, x: 90, y: 130.05, level: 0 } });
        expect(v.agrees).toBe(false);
        expect(v.text).toBe('disagrees (x Δ2 > 0)');
        expect(verdictOf(expected(), status(), END_STATE_TOLERANCE,
            { finalFrame: { t: 166, x: 88, y: 130.05, level: 3 } }).text)
            .toBe('disagrees (level 3≠0)');
    });

    it('⛔ ITEMS still come from `botStatus` — the stream does not carry them', () => {
        // An observation is `{t, x, y, level}`. The frame swap must move
        // position and level and nothing else, or a real missing-item finding
        // would vanish with it.
        const v = verdictOf(expected(), status({ items: { hitsMax: 3 } }),
            END_STATE_TOLERANCE, { finalFrame: { t: 166, ...expected() } });
        expect(v.text).toBe('disagrees (missing hasSword)');
    });

    it('⛓ a build with NO drain falls back to `botStatus`, and SAYS which', () => {
        // The labelled fallback, the same shape the per-tick verdict's
        // `unavailable` uses: an absent channel is an answer, not a silence.
        const v = verdictOf(expected(), status(), END_STATE_TOLERANCE,
            { finalFrame: lastObservationOf(null) });
        expect(v.agrees).toBe(true);
        expect(v.frameSource).toBe('botStatus');
    });
});

describe('lastObservationOf — the frame the end state is about', () => {
    it('is the LAST tick of the drain, and it is the comparator\'s own object', () => {
        // `gameStreamFromDrain`'s `stream.ticks` IS `drained.ticks`; only
        // `transitions` is derived. So this is the same object the per-tick
        // comparison reads, not a second reading of it.
        const ticks = [{ t: 0, x: 1, y: 2, level: 0 }, { t: 1, x: 3, y: 4, level: 0 }];
        expect(lastObservationOf({ ticks })).toBe(ticks[1]);
    });

    it('⛔ answers null rather than throwing, on every shape it cannot read', () => {
        // A verdict that died here would take the whole ship's readout with it,
        // and "this build has no botDrain" is the FALLBACK's business.
        expect(lastObservationOf(null)).toBe(null);
        expect(lastObservationOf({})).toBe(null);
        expect(lastObservationOf({ ticks: [] })).toBe(null);
        expect(lastObservationOf({ ticks: [null] })).toBe(null);
        expect(lastObservationOf({ ticks: [{ t: 0, y: 2 }] })).toBe(null);
        expect(lastObservationOf({ ticks: [{ t: 0, x: 'NaN', y: 2 }] })).toBe(null);
    });
});

describe('roomOfGeneratedLevel — which room a generated level becomes', () => {
    it('⛓ 900 becomes room 0, and the note SAYS the remap happened', () => {
        const m = roomOfGeneratedLevel(900, 1, [900]);
        expect(m.room).toBe(0);
        expect(m.remapped).toBe(true);
        expect(m.why).toBe(
            'level remapped 900→0 (the generated room is room 0 of the shipped set)');
    });

    it('a level that IS already its own room index passes through unremarked', () => {
        expect(roomOfGeneratedLevel(0, 1, [0])).toEqual({ room: 0, remapped: false, why: null });
        expect(roomOfGeneratedLevel(2, 3, [7, 9, 2]).room).toBe(2);
    });

    it('⛔ REFUSES rather than mapping an unknown level to 0', () => {
        // Mapping anything to 0 would invent an agreement: the verdict would
        // compare the model's end state against a room the set never carried.
        const m = roomOfGeneratedLevel(7, 1, [900]);
        expect(m.room).toBe(null);
        expect(m.why).toMatch(/not in this set's order/);
        expect(roomOfGeneratedLevel(900, 1).room).toBe(null);
        expect(roomOfGeneratedLevel(0, 0, [0]).room).toBe(null);
    });
});

describe('levelSetDisagreement — the readback is the proof a set MOUNTED', () => {
    const sent = { set_id: 'watch-oneroom-pre-sword-1-4-e5c2cdf3', rooms: [{}], start: { level: 0 } };
    const back = { active: sent.set_id, table_levels: 1, start_level: 0 };

    it('agrees when the artifact reports the set that was sent', () => {
        expect(levelSetDisagreement(sent, back)).toBe(null);
    });

    it('⛓ M-readback: a CORRUPTED content hash is named, field and both values', () => {
        // `set_id` carries the content hash (`stampLevelSetIdentity`), so
        // comparing it compares the bytes — this is the mutant the brief asks
        // for, and it must name what disagreed rather than say "disagrees".
        const why = levelSetDisagreement(sent, { ...back, active: 'watch-oneroom-pre-sword-1-4-deadbeef' });
        expect(why).toBe(
            'active watch-oneroom-pre-sword-1-4-deadbeef ≠ watch-oneroom-pre-sword-1-4-e5c2cdf3');
    });

    it('⛓ a delivery that never landed is a DIFFERENT finding from a wrong one', () => {
        expect(levelSetDisagreement(sent, { ...back, table_levels: 0 }))
            .toBe('table_levels 0 ≠ 1');
        expect(levelSetDisagreement(sent, { ...back, start_level: 3 }))
            .toBe('start_level 3 ≠ 0');
        expect(levelSetDisagreement(sent, { ...back, error: 'chunk 1 of 2 missing' }))
            .toMatch(/recorded a level-set error/);
        expect(levelSetDisagreement(sent, null)).toMatch(/answered nothing/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ SEEDLING BOT R9, SLICE 1 (E3) — **WHAT A SHIP PUBLISHES**, and the
 * field the ship row had to REGEX for want of it.
 * ══════════════════════════════════════════════════════════════════════ */

describe('E3 — `publishShip` projects the verdict NOTE, so a claim about the remap has a field', () => {
    /**
     * ⛔ ASSERTED OVER THE SOURCE, for `watchWasm.test.js`' own reason one
     * describe below: `publishShip` is a closure inside `watchViewer.js` with no
     * import surface, and the fact under test is *which keys the projection
     * carries* — a question about the code, not about a run. ⚠ Comments are
     * stripped first: this file and `watchViewer.js` both DISCUSS the missing
     * `note`, and a scan that could not see a comment would pass on the prose.
     */
    const projectionKeys = () => {
        const body = source('watchViewer.js')
            .split('function publishShip(')[1]
            .split('\n}')[0]
            .split('\n')
            .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l));
        return body.join('\n').match(/^\s{8}(\w+):/gm).map((m) => m.trim().replace(':', ''));
    };

    it('⛓⛓ carries `note` — the field the ship row reads STRUCTURALLY', () => {
        expect(projectionKeys()).toContain('note');
    });

    /**
     * ⛔⛔⛔ R9 SLICE 3 — **THE GAME-VISIBLE PROJECTION, ON THE SHIP PATH.**
     *
     * `gameVisibleTape` is the ONE classification of what a game-facing channel
     * may hand to `botLoadTape` (`GAME_VISIBLE_DROPS` — the v9 `at` on a
     * persistence clear and v10's `despawn`, both statements about what the GAME
     * DOES ON ITS OWN rather than instructions to it). The differential has
     * projected since R7 slice 6d; this path did not, and it was INVISIBLE
     * because every tape it had ever shipped was v8 or below.
     *
     * The splice put a v9 tape into a sequence and the real GPU said, at
     * `tape 1/3`: `botLoadTape: error:tape_version must be 1, 2, 3, 4, 5, 6, 7
     * or 8, got 9`. ⇒ this row exists so the projection cannot be dropped again
     * by a refactor — the browser arm that would catch it costs a GPU and 15
     * minutes, and a claim nobody re-runs is a claim that decays (trap 474).
     *
     * ⛓⛓ R9 SLICE 5 RE-PINNED IT, AND IT WAS RIGHT TO RED (trap 495's shape —
     * a gate that TYPED the old spelling). There are now TWO projections, one
     * per window kind: `gameVisibleTape` for window 1 (a fresh boot applies
     * everything) and `continuationTape` for k > 0 (which composes
     * `gameVisibleTape` and then strips the three rng stream positions). So the
     * claim is no longer "one spelling reaches the call" but "the value handed
     * to `botLoadTape` came out of a PROJECTION, and both projections exist" —
     * which is the claim that was meant all along.
     */
    it('⛔⛔ `botLoadTape` is handed a PROJECTION, never the raw tape', () => {
        const live = source('watchWasm.js').split('\n')
            .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l));
        const body = live
            // ⚠ the CALL, not the refusal message that names it
            .filter((l) => /bot\('botLoadTape'/.test(l));
        expect(body.length).toBeGreaterThan(0);
        // ⛔ the ARGUMENT is a projected object, never `w.tape`
        for (const line of body) {
            expect(line).toMatch(/projected\.tape|gameVisibleTape\(/);
            expect(line).not.toMatch(/JSON\.stringify\(w\.tape\)/);
        }
        // ⛔ …and BOTH projections are on the path, by name — one per window kind
        const chose = live.filter((l) => /continuationTape\(w\.tape\)/.test(l));
        expect(chose.length).toBeGreaterThan(0);
        expect(chose.join('\n')).toMatch(/k > 0/);
        expect(live.filter((l) => /gameVisibleTape\(w\.tape\)/.test(l)).length)
            .toBeGreaterThan(0);
    });

    it('⛓ …and the projection is what makes a v9 tape loadable AT ALL — the AS3 '
        + 'loader gates on its VERSION LIST', () => {
        const v9 = loadTape('r8-solve-18');
        expect(v9.tape_version).toBe(9);
        expect(v9.persistence.some((c) => c.at !== undefined)).toBe(true);
        const projected = gameVisibleTape(v9);
        expect(projected.tape_version).toBe(8);
        expect(projected.persistence.some((c) => c.at !== undefined)).toBe(false);
        // ⚠ and BYTE-INERT for everything that shipped before it: a v8 tape
        //   projects to itself, so the single-tape arms are unaffected by
        //   construction rather than by re-measurement.
        const v8 = loadTape('r8-d2-19');
        expect(JSON.stringify(gameVisibleTape(v8))).toBe(JSON.stringify(v8));
    });

    /**
     * ⛓ THE WHOLE PROJECTION, PINNED. ⛔ A ship publishes ONE shape in both arms
     * (the button's panel and REPLAY's shared chrome), and a key that appeared
     * in one and not the other is exactly what made a REPLAY per-tick verdict
     * unassertable. A literal list is what notices a key quietly leaving.
     */
    it('⛔ and the projection is these keys, exactly', () => {
        expect(projectionKeys().sort()).toEqual([
            'drain', 'label', 'note', 'reached', 'refusal', 'scope', 'set', 'stage',
            'stages', 'status', 'verdict',
            // ⛓ R9 slice 2: the SEQUENCE's per-window rows — admission, the
            // per-window verdict, `continuationFindings`, the keys the boundary
            // released and whether the player MOVED across it. Empty for a
            // single-tape ship, which is every pre-existing caller.
            'windows',
        ].sort());
    });

    /** ⚠ AND THE SCAN IS NOT VACUOUS — it sees a key that is not there. */
    it('\u26a0 the scan is NOT vacuous — it does not report a key nobody wrote', () => {
        expect(projectionKeys()).not.toContain('thereIsNoSuchKey');
    });
});

describe('⛔⛔ THE PARENT NEVER STARTS THE GAME — the law, as a TEST', () => {
    /**
     * ⛓⛓⛓ M-start. This was a COMMENT for the whole of the editor arc, and a
     * comment is exactly what the defect it describes survives: a first cut
     * called `btn.click()` from the parent as a harmless-looking convenience,
     * which LATCHES `started = true` and HIDES the button, so `runSWF` runs
     * with no user activation, the renderer never comes up, `botStatus` never
     * appears — and the user's real click is now impossible. The symptom is
     * maximally unhelpful: `__swfBridge.game` exists, so the shim looks fine
     * and the wait just spins.
     *
     * ⛔ ASSERTED OVER THE SOURCE, because there is no runtime moment at which
     * "nobody pressed Start from here" can be observed — the same discipline
     * `watchLifetime.test.js` uses for `addEventListener`, and the same reason.
     *
     * ⚠ A ROW MAY DO WHAT THIS PAGE MAY NOT: Playwright's click is a real
     * input event with real user activation, so `check-seedling-wasm-pages.mjs`
     * clicking `#btn-start` INSIDE the frame is legal and is how the live arm
     * gets past this stage. The rule is about the page's own code.
     */
    /**
     * ⛔ TWO TOKENS, AND NOT A GENERIC `.click(`. The first cut forbade any
     * `.click(` and immediately reported a FALSE finding about the code: both
     * files build a download anchor and click it, which is a save dialog and
     * has nothing to do with the game. A scan that reds on the wrong lines is
     * a scan somebody will delete.
     *
     * ⛓ These two ARE the whole surface: `runSWF` is reachable only through
     * `__swfBridgeStart`, and the only element that calls it is `#btn-start`.
     * A two-line form (`const b = …getElementById('btn-start'); b.click();`) is
     * still caught, on its first line.
     */
    const FORBIDDEN = [
        // the frame's own start entry point
        /__swfBridgeStart/,
        // the button that calls it, by id, however it is reached
        /btn-start/,
    ];

    for (const file of ['watchWasm.js', 'watchViewer.js']) {
        it(`${file} never presses \u25b6 Start`, () => {
            const offenders = source(file).split('\n')
                .map((line, i) => ({ line, n: i + 1 }))
                // ⛔ COMMENTS ARE STRIPPED FIRST, and that is not a convenience:
                // both files EXPLAIN this law at length and quote
                // `__swfBridgeStart` while doing so, so a scan that could not
                // see a comment would report a false finding about the code
                // (trap 395's family — read what runs, not what is written).
                .filter((r) => !/^\s*(\*|\/\/|\/\*)/.test(r.line))
                .filter((r) => FORBIDDEN.some((re) => re.test(r.line)))
                .map((r) => `${file}:${r.n}  ${r.line.trim()}`);
            expect(offenders).toEqual([]);
        });
    }

    it('\u26a0 and the scan is NOT vacuous — it sees the call when one is there', () => {
        // The mutant, inline: the same predicate over a line that DOES press
        // Start must find it. Without this the two rows above would pass on an
        // empty file, on a stripped comment, or on a broken regex.
        const mutant = ['    win().__swfBridgeStart();',
            '    const btn = win().document.getElementById(\'btn-start\'); btn.click();'];
        const seen = mutant.filter((line) => FORBIDDEN.some((re) => re.test(line)));
        expect(seen).toHaveLength(2);
    });
});

/**
 * ── ⛓⛓⛓ THE PER-TICK VERDICT ─────────────────────────────────────────
 *
 * ⛔ THE COMPARATOR IS `tapeFormat.diffObservationStreams` AND NOTHING HERE
 * RE-SPELLS IT. What these rows assert is the DECISION around it: which of the
 * five answers a ship gets, what each one says, and the one answer the design
 * exists to make impossible (a per-tick `agrees` printed beside an end state
 * that disagrees about the same frame).
 */
describe('the per-tick verdict', () => {
    /** A stream in the vocabulary both sides are read in. */
    const streamOf = (rows, transitions = []) => ({
        ticks: rows.map((r, t) => ({ t, x: r[0], y: r[1], level: r[2] ?? 0 })),
        transitions,
    });
    const model = streamOf([[80, 128], [82, 128], [84, 128]]);
    /** What `botDrain` really returns: the ticks, and `transitions` hardcoded []. */
    const drainOf = (s) => ({ ticks: s.ticks, transitions: [] });

    it('⛓⛓⛓ AGREES PER TICK, and says how many observations that was', () => {
        const v = perTickVerdictOf({
            modelStream: model, drained: drainOf(model), endState: verdictOf(expected(), status()),
        });
        expect(v.kind).toBe('agrees');
        expect(v.agrees).toBe(true);
        expect(v.observations).toBe(3);
        expect(v.text).toBe('agrees per tick (3 observations)');
    });

    it('⛓ M-first: a divergence at tick k is reported AT k, verbatim, with both lengths', () => {
        const game = structuredClone(model);
        game.ticks[2].x = 90;
        const v = perTickVerdictOf({ modelStream: model, drained: drainOf(game) });
        expect(v.kind).toBe('diverges');
        expect(v.agrees).toBe(false);
        // The comparator's OWN sentence — this module does not paraphrase it.
        expect(v.diff).toMatch(/^tick 2 differs: expected \(x=84, y=128, level=0\), got \(x=90/);
        expect(v.text).toMatch(/^diverges — tick 2 differs/);
        expect(v.text).toMatch(/\(model 3 observation\(s\), game 3\)$/);
    });

    it('⛔ M-fallback: no drain ⇒ the END-STATE verdict, LABELLED as the fallback', () => {
        const v = perTickVerdictOf({ modelStream: model, drained: null });
        expect(v.kind).toBe('unavailable');
        expect(v.text).toBe('end-state only (no drain on this build)');
        expect(v.observations).toBeNull();
        expect(perTickVerdictOf({ modelStream: model, drained: { ticks: 'nope' } }).kind)
            .toBe('unavailable');
    });

    it('⛔ MANUAL is VACUOUS and says so — with the drained count beside it', () => {
        // A zero-input tape has no run to reproduce. A per-tick comparison over
        // it would be agreement on the boot frame, printed as if the real game
        // had reproduced something.
        const v = perTickVerdictOf({
            modelStream: null, modelStreamWhy: 'manual — nothing has been driven in JS',
            drained: drainOf(streamOf([[80, 128]])),
        });
        expect(v.kind).toBe('none');
        expect(v.agrees).toBeNull();
        expect(v.observations).toBe(1);
        expect(v.text).toMatch(/no per-tick comparison \(manual — nothing has been driven in JS\)/);
        expect(v.text).toMatch(/1 observation\(s\) drained from the game/);
    });

    it('⛓ a ship that REFUSED gets a per-tick state too — never a bare null', () => {
        const v = perTickVerdictOf({ notFinished: 'start-never-pressed' });
        expect(v.kind).toBe('not-finished');
        expect(v.text).toMatch(/not finished \(start-never-pressed\)/);
        expect(v.text).toMatch(/nothing to drain/);
    });

    it('⛓⛓ M-vocab: a stream in a DIFFERENT vocabulary is REFUSED, by field name', () => {
        // The proof that the vocabulary is CHECKED and not assumed: rename one
        // observation's field and the comparator's own validator names it.
        const renamed = structuredClone(model);
        delete renamed.ticks[1].x;
        renamed.ticks[1].xx = 82;
        const v = perTickVerdictOf({ modelStream: renamed, drained: drainOf(model) });
        expect(v.kind).toBe('refused');
        expect(v.text).toMatch(/per-tick comparison refused:.*ticks\[1\]\.x/);
    });

    it('⛔ a build that FILLS `transitions` in for real is a refusal to reconcile', () => {
        const drained = { ticks: model.ticks, transitions: [{ t: 1, from_level: 0, to_level: 4 }] };
        const v = perTickVerdictOf({ modelStream: model, drained });
        expect(v.kind).toBe('refused');
        expect(v.text).toMatch(/needs revisiting/);
    });

    /**
     * ── ⛔⛔ THE ONE ANSWER THIS DESIGN EXISTS TO MAKE IMPOSSIBLE (⚖ D2) ──
     */
    describe('the consistency gate', () => {
        it('M-consistent: per tick agrees + the END STATE disagrees about the same '
            + 'frame ⇒ verdict-internally-inconsistent, NEVER `agrees`', () => {
            // `botStatus` says one thing about the last frame and `botDrain`
            // says another. That is a defect in the comparison, not a finding
            // about the run, and it must be impossible to print as agreement.
            const endState = verdictOf(expected({ x: 84, y: 128, level: 0, items: {} }),
                status({ x: 90, y: 128, level: 0, items: {} }));
            expect(endState.kind).toBe('disagrees');
            const v = perTickVerdictOf({ modelStream: model, drained: drainOf(model), endState });
            expect(v.kind).toBe('inconsistent');
            expect(v.agrees).toBe(false);
            expect(v.text).toMatch(/verdict-internally-inconsistent/);
            expect(v.text).toMatch(/botStatus and botDrain disagree about the same frame/);
            expect(v.text).not.toMatch(/^agrees/);
        });

        it('⛓ …but an ITEMS-ONLY disagreement is a FINDING, not an inconsistency', () => {
            // An observation is {t,x,y,level} and carries NO items, so
            // `missing hasSword` is the end-state check answering a question
            // the per-tick one never asked. Calling that "internally
            // inconsistent" would relabel a real finding as an instrument bug.
            const endState = verdictOf(
                expected({ x: 84, y: 128, level: 0, items: { hasSword: true } }),
                status({ x: 84, y: 128, level: 0, items: {} }));
            expect(endState.kind).toBe('disagrees');
            expect(endState.text).toMatch(/missing hasSword/);
            const v = perTickVerdictOf({ modelStream: model, drained: drainOf(model), endState });
            expect(v.kind).toBe('agrees');
        });
    });
});

/**
 * ⛓⛓ THE REMAP, ACROSS A WHOLE STREAM — every observation of a generated walk
 * carries 900, not just the last one.
 */
describe('a generated room\'s stream, remapped to the shipped set', () => {
    const gen = {
        ticks: [
            { t: 0, x: 16, y: 16, level: 900 },
            { t: 1, x: 18, y: 16, level: 900 },
        ],
        transitions: [],
    };

    it('maps every tick through the ONE function that owns the mapping', () => {
        expect(remapStreamRooms(gen, 1, [900]).ticks)
            .toEqual([{ t: 0, x: 16, y: 16, level: 0 }, { t: 1, x: 18, y: 16, level: 0 }]);
    });

    it('maps the TRANSITIONS\' endpoints too, not only the ticks', () => {
        const two = {
            ticks: [{ t: 0, x: 1, y: 1, level: 900 }, { t: 1, x: 1, y: 1, level: 901 }],
            transitions: [{ t: 1, from_level: 900, to_level: 901 }],
        };
        expect(remapStreamRooms(two, 2, [900, 901]).transitions)
            .toEqual([{ t: 1, from_level: 0, to_level: 1 }]);
    });

    it('⛔ REFUSES a level the set does not contain rather than inventing room 0', () => {
        expect(() => remapStreamRooms(gen, 1, [42]))
            .toThrow(/level 900 is not in this set's order/);
    });

    it('⛔ …and refuses an ABSENT stream rather than remapping an empty one', () => {
        // `modelStreamOf` answers null for a walk that did not finish, and
        // `{ticks: []}` diffs as "tick count differs: expected 0, got 256" —
        // a confident sentence about a comparison that never happened.
        expect(() => remapStreamRooms(null, 1, [900])).toThrow(/no model stream to remap/);
        expect(() => remapStreamRooms({ ticks: [] }, 1, [900]))
            .toThrow(/no model stream to remap/);
    });
});

/**
 * ⛓ THE PRINTED BLOCK — asserted as TEXT, because that is what a reader gets.
 */
describe('what the page prints beside the JS certification', () => {
    const end = verdictOf(expected(), status());

    it('⛓⛓ prints BOTH verdicts, each with the scope its own claim needs', () => {
        const v = { ...end, perTick: { kind: 'agrees', text: 'agrees per tick (3 observations)' } };
        const lines = verdictBlock(v).split('\n');
        expect(lines[0]).toBe(`wasm verdict: agrees per tick (3 observations)  —  ${PER_TICK_SCOPE}`);
        expect(lines[1]).toBe(`end state: agrees  —  ${VERDICT_SCOPE}`);
    });

    it('⛔ the END-STATE line is NEVER dropped — it is what an inconsistency is '
        + 'inconsistent WITH', () => {
        const v = { ...end, perTick: { kind: 'inconsistent', text: 'verdict-internally-inconsistent — …' } };
        expect(verdictBlock(v)).toMatch(/\nend state: agrees {2}— {2}/);
        expect(verdictBlock(v)).toMatch(/end state only/);
    });

    it('falls back to ONE line when nothing per-tick was answered', () => {
        const v = { ...end, perTick: { kind: 'unavailable', text: 'end-state only (no drain on this build)' } };
        const lines = verdictBlock(v, 'level remapped 900→0').split('\n');
        expect(lines[0]).toBe(`wasm verdict: agrees  —  ${VERDICT_SCOPE}`);
        expect(lines[1]).toBe('per tick: end-state only (no drain on this build)');
        expect(lines[2]).toBe('level remapped 900→0');
    });

    it('⛓ a refusal does not repeat itself on a second line', () => {
        const refused = verdictOf(null, null, END_STATE_TOLERANCE,
            { refusal: { reason: 'wasm-build-missing' } });
        const v = { ...refused, perTick: perTickVerdictOf({ notFinished: 'wasm-build-missing' }) };
        expect(verdictBlock(v).split('\n')).toHaveLength(1);
    });

    it('⛔⛔ the SCOPES name BOTH limits the per-tick verdict has (⚖ D3)', () => {
        // 1. it is against the MODEL, not against a recorded expectation;
        // 2. trap 389 — both sides share this repo's tape and observation code.
        expect(PER_TICK_SCOPE).toMatch(/JS MODEL/);
        expect(PER_TICK_SCOPE).toMatch(/not against a recorded expectation/);
        expect(PER_TICK_SCOPE).toMatch(/share/);
        expect(PER_TICK_SCOPE).toMatch(/invisible/);
        expect(VERDICT_SCOPE).toMatch(/end state only/);
    });
});


/**
 * ══ ⛓⛓⛓ R9 SLICE 2 — THE SEQUENCE, ON THIS SIDE (⚖ ruling 10) ═══════════
 */
describe('the window vocabulary', () => {
    it('⛔ ONE window is the OLD list, exactly — every row asserts on these names', () => {
        expect(stagesOf({ windows: 1 })).toEqual(stagesOf({}));
        expect(stagesOf({ windows: 1 })).toEqual(
            WASM_STAGES.filter((x) => x !== 'levels'));
        expect(stagesOf({ windows: 1, levelSet: { set_id: 'x', rooms: [{}] } }))
            .toEqual([...WASM_STAGES]);
    });

    it('⛓ N windows number the per-window stages and put a BOUNDARY between them', () => {
        expect(stagesOf({ windows: 2 })).toEqual([
            'probe', 'runtime', 'start',
            'tape 1/2', 'running 1/2', 'finished 1/2', 'drain 1/2',
            'boundary 1/2',
            'tape 2/2', 'running 2/2', 'finished 2/2', 'drain 2/2',
            'verdict',
        ]);
        // ⛔ ONE `start`: `freshFrame()` and the human ▶ Start happen once.
        expect(stagesOf({ windows: 3 }).filter((x) => x === 'start')).toHaveLength(1);
        expect(stagesOf({ windows: 3 }).filter((x) => x.startsWith('drain'))).toHaveLength(3);
        expect(stagesOf({ windows: 3 })
            .filter((x) => x.startsWith('boundary'))).toHaveLength(2);
    });
});

describe('⛓⛓ the drains are concatenated the way the HEADLINE ARITHMETIC does it', () => {
    /**
     * ⛔ EACH WINDOW'S DRAIN IS ITS OWN BUFFER (trap 436 — a live read versus a
     * buffered stream). Its ticks restart at 0, so the offset is not cosmetic:
     * without it the whole-sequence verdict would compare window 2's tick 5
     * against the model's tick 5, which is in window 1.
     */
    const drainOf = (from, n, tag) => ({
        ticks: Array.from({ length: n + 1 }, (_, i) => ({ t: i, x: from + i, tag })),
    });

    it('drops each window\'s duplicated FIRST observation and shifts by tick_count', () => {
        const got = concatDrains([drainOf(0, 3, 'a'), drainOf(3, 2, 'b')], [3, 2]);
        expect(got.ticks.map((o) => o.t)).toEqual([0, 1, 2, 3, 4, 5]);
        // 4 observations from window 1 (0..3, minus its last) + 3 from window 2
        expect(got.ticks).toHaveLength(6);
        expect(got.ticks[3].tag).toBe('b');
        // ⛓ the SUM identity `chainFindings` asserts: 3 + 2 ticks = 6 observations
        expect(got.ticks).toHaveLength(3 + 2 + 1);
    });

    it('a single window is passed through unshifted', () => {
        const one = drainOf(0, 4, 'a');
        expect(concatDrains([one], [4]).ticks).toEqual(one.ticks);
    });

    it('a window that drained NOTHING contributes nothing and does not shift wrongly', () => {
        const got = concatDrains([{ ticks: [] }, drainOf(0, 1, 'b')], [7, 1]);
        expect(got.ticks.map((o) => o.t)).toEqual([7, 8]);
    });
});


/**
 * ⛓⛓⛓ R9 SLICE 5 (⚖ ruling 12 (d), ruling 14) — **THE CONTINUATION
 * PROJECTION**, which is what the page hands `botLoadTape` for k > 0 and ONLY
 * after `continuationAdmission` has already asserted the declaration.
 *
 * ⛔ THE MUTANT THAT MAKES THIS A GATE: remove the strip (hand
 * `gameVisibleTape(tape)` at every window) and `boundary 2/3` of `?tapes=r8-d2`
 * refuses on `rng` exactly as slice 3 measured — `botStart` applies the
 * declared seed on a continuation and rewinds the live stream by L19's build
 * (§11.12(iii), trap 492). The rows below are the headless half of that; the
 * GPU half is `check-seedling-wasm-ship.mjs`'s CHAIN arm.
 */
describe('⛓⛓⛓ the continuation projection — the rng strip, AFTER the admission', () => {
    const rng = { seed: 1823918582, split: false, cosmetic: 4, fp: 1752443622 };
    const tape = (over = {}) => ({
        tape_version: 8, name: 'w', boot: { level: 20, x: 192, y: 64 },
        tick_count: 3, inputs: [], persistence: [], grants: [], rng, ...over,
    });

    it('⛓ a continuation window is handed ZEROS for the three STREAM POSITIONS', () => {
        const { tape: out } = continuationTape(tape());
        expect(out.rng).toEqual({ seed: 0, split: false, cosmetic: 0, fp: 0 });
    });

    it('⛔ …and `split` is KEPT — `Rng.split` is assigned UNCONDITIONALLY (Bot.as:1771)', () => {
        expect(continuationTape(tape({ rng: { ...rng, split: true } })).tape.rng.split)
            .toBe(true);
        // ⛔ the OTHER three are still zeroed beside it — the keep is one field,
        //    not a bail-out.
        expect(continuationTape(tape({ rng: { ...rng, split: true } })).tape.rng)
            .toEqual({ seed: 0, split: true, cosmetic: 0, fp: 0 });
    });

    it('⛓ the page SAYS WHAT IT DID — `rngStripped` is the DECLARED triple, as a FIELD', () => {
        // ⛔ a field, never a sentence to regex (trap 269 — echo is not value).
        expect(continuationTape(tape()).rngStripped)
            .toEqual({ seed: 1823918582, cosmetic: 4, fp: 1752443622 });
    });

    it('a tape that declares NO `rng` block is projected unchanged, and says so', () => {
        // ⚠ 110 of the 154 tapes on the roster are pre-v7 and carry none.
        const { tape: out, rngStripped } = continuationTape(tape({ rng: undefined }));
        expect(rngStripped).toBe(null);
        expect(out.rng).toBeUndefined();
    });

    it('⛔ WINDOW 1 IS UNTOUCHED — the projection is `gameVisibleTape`, unchanged', () => {
        // The page calls `gameVisibleTape` directly for k === 0; this asserts the
        // two projections really do differ, so "window 1 is untouched" is a
        // measurable claim rather than a comment.
        const t = tape();
        expect(gameVisibleTape(t).rng).toEqual(rng);
        expect(continuationTape(t).tape.rng).not.toEqual(rng);
    });

    it('⛓ everything `gameVisibleTape` drops is still dropped — the projection COMPOSES', () => {
        const v9 = tape({
            tape_version: 9,
            persistence: [{ level: 5, tag: 0, at: 427 }, { level: 8, tag: 1 }],
        });
        const out = continuationTape(v9).tape;
        expect(out.tape_version).toBe(8);
        expect(out.persistence.every((c) => c.at === undefined)).toBe(true);
    });

    /**
     * ⛓⛓⛓ R9 SLICE 5's SECOND HALF — the FORWARD declarations do not reach the
     * game. `gameVisibleTape` alone KEEPS the row and drops only `at`, which
     * on a fresh page reproduces the recorded state and on a continuation
     * opens the lock before the walk that opens it.
     */
    it('⛔⛔ a TIMED row is NOT handed to the game — it would arrive AT BOOT', () => {
        const v9 = tape({
            tape_version: 9,
            persistence: [{ level: 5, tag: 0, at: 427 }, { level: 8, tag: 1 }],
        });
        const { tape: out, forwardRows } = continuationTape(v9);
        // ⛔ the LATCH row survives (the admission just asserted it equals the
        //    live set, so applying it is a no-op); the FORWARD row does not.
        expect(out.persistence).toEqual([{ level: 8, tag: 1 }]);
        expect(forwardRows).toEqual(['5:0@427']);
        // ⛔ and `gameVisibleTape` on its own would have handed BOTH over —
        //    which is the difference this projection exists to make.
        expect(gameVisibleTape(v9).persistence).toHaveLength(2);
    });

    it('a window with no forward rows reports an EMPTY list, never a missing one', () => {
        expect(continuationTape(tape({ persistence: [{ level: 8, tag: 1 }] })).forwardRows)
            .toEqual([]);
    });

    /**
     * ⛓⛓⛓ R9 SLICE 5 — **THE LATCHED BLOCKS ARE ON THE RECORD**, and the
     * measurement that forced it is the CHAIN arm's own: under (d)
     * `boundary 2/3` refuses on `seam` with ONE number differing
     * (`time` 10213 declared vs 10192 live), and that number lived only inside
     * the finding's DETAIL SENTENCE. A gate asserting the residual would have
     * had to regex a sentence for a value — trap 269, exactly the shape this
     * page keeps paying for. ⇒ published as DATA.
     */
    it('⛔⛔ the boundary record carries the LIVE BLOCKS the admission compared against',
        () => {
            const live = source('watchWasm.js')
                .slice(source('watchWasm.js').indexOf('rec.live = {'));
            expect(live.slice(0, 220)).toMatch(/blocks: live\.blocks/);
            expect(live.slice(0, 220)).toMatch(/blocksWhy: live\.blocksWhy/);
        });
});

/**
 * ⛓⛓⛓ R9 SLICE 6 (⚖ ruling 15, option (d′)) — **THE CLOCK, THE OTHER
 * DIRECTION**: the one field a continuation window is handed MORE of.
 *
 * Slice 5's (d) moved the boundary refusal off `rng` and onto `seam.time` and
 * measured what was left on three independent chains: declared − live = 21 at
 * every boundary after the first, with every other seam row EQUAL (§13.6).
 * `Bot.as:1703` writes `Main.time = seamTime` on a continuation too, and
 * `botStart` then does NOT rebuild, so the walk starts without the fade its
 * recording was made behind.
 *
 * ⛔ THE MUTANT THAT MAKES THIS A GATE: remove the bump and `boundary 2/3` of
 * `?tapes=r8-d2` refuses on `seam.time` with declared 10213 against live
 * 10192 — which is not a hypothetical, it is slice 5's own measurement, so no
 * GPU is spent to see it again.
 *
 * ⛔ AND THERE IS NO JS COUNTERPART. `gameClock.test.js`'s resumed-clock sweep
 * measures why: the model's clock is ALREADY `declared + BOOT_COST_FRAMES` at
 * every boundary it can answer for.
 */
describe('⛓⛓⛓ (d′) — the continuation window is handed `seam.time + bootCost`', () => {
    const seam = { time: 10213, day: 0, music: [1, 0] };
    const tape = (over = {}) => ({
        tape_version: 8, name: 'w', boot: { level: 20, x: 192, y: 64 },
        tick_count: 3, inputs: [], persistence: [], grants: [], seam, ...over,
    });

    it('⛓ `BOOT_COST_FRAMES` is DERIVED from the two constants, never typed', () => {
        expect(BOOT_COST_FRAMES).toBe(LOAD_FADE_FRAMES + BOOT_PRESWAP_FRAMES);
        expect(BOOT_COST_FRAMES).toBe(21);
        // ⛔ and the module does not spell the number anywhere: a literal 21
        //    here would survive a physics edit that moved either constant.
        const body = source('watchWasm.js');
        expect(body.slice(body.indexOf('export function continuationTape')))
            .not.toMatch(/\b21\b/);
    });

    it('⛔⛔ a continuation window\'s loaded tape declares `declared + bootCost`', () => {
        const { tape: out, clockBumped } = continuationTape(tape());
        expect(out.seam.time).toBe(10213 + BOOT_COST_FRAMES);
        expect(clockBumped).toEqual({
            declared: 10213, applied: 10234, bootCost: BOOT_COST_FRAMES,
        });
    });

    it('⛓ …and NOTHING ELSE in the seam block moves — `time` is the only row', () => {
        const { tape: out } = continuationTape(tape());
        expect({ ...out.seam, time: undefined }).toEqual({ ...seam, time: undefined });
    });

    it('⛔ a ZERO `seam.time` STAYS ZERO — `Bot.as:1703` gates on `!= 0`', () => {
        const { tape: out, clockBumped } = continuationTape(tape({
            seam: { ...seam, time: 0 },
        }));
        expect(out.seam.time).toBe(0);
        expect(clockBumped).toBe(null);
    });

    it('a tape that declares NO `seam` block is untouched, and says so', () => {
        // ⚠ 110 of the 154 tapes on the roster are pre-v7; `r8-solve-1` — the
        //   TRUE START, and window 1 of the campaign chain — declares none.
        const { tape: out, clockBumped } = continuationTape(tape({ seam: undefined }));
        expect(out.seam).toBeUndefined();
        expect(clockBumped).toBe(null);
    });

    it('⛔ WINDOW 1 IS UNTOUCHED — `gameVisibleTape` keeps the declaration', () => {
        expect(gameVisibleTape(tape()).seam.time).toBe(10213);
    });

    it('⛓ the bump COMPOSES with the rng strip and the timed-row withholding', () => {
        const v9 = tape({
            tape_version: 9,
            rng: { seed: 5, split: false, cosmetic: 4, fp: 7 },
            persistence: [{ level: 5, tag: 0, at: 427 }, { level: 8, tag: 1 }],
        });
        const { tape: out, rngStripped, forwardRows, clockBumped } = continuationTape(v9);
        expect(out.seam.time).toBe(10213 + BOOT_COST_FRAMES);
        expect(out.rng).toEqual({ seed: 0, split: false, cosmetic: 0, fp: 0 });
        expect(out.persistence).toEqual([{ level: 8, tag: 1 }]);
        expect(rngStripped).toEqual({ seed: 5, cosmetic: 4, fp: 7 });
        expect(forwardRows).toEqual(['5:0@427']);
        expect(clockBumped.applied).toBe(10234);
    });

    it('⛔ the bump happens AFTER the admission — the ORDER, in the page\'s own source',
        () => {
            const body = source('watchWasm.js');
            const admit = body.indexOf('const found = continuationAdmission(w.tape, live');
            const project = body.indexOf('k > 0 ? continuationTape(w.tape)');
            expect(admit).toBeGreaterThan(0);
            expect(project).toBeGreaterThan(admit);
            // ⛔ and the admission is handed `w.tape` — the DECLARATION — not
            //    the projected copy. Bumping first would admit a number nobody
            //    declared.
            expect(body.slice(admit, admit + 90)).toMatch(/continuationAdmission\(w\.tape/);
        });
});
