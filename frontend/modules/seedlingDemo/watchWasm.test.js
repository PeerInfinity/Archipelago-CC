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

import {
    END_STATE_TOLERANCE, levelSetDisagreement, roomOfGeneratedLevel, stagesOf,
    VERDICT_SCOPE, verdictLine, verdictOf, WASM_PAGE, WASM_STAGES,
} from './watchWasm.js';

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
    it('names the eight stages in the order a ship reaches them', () => {
        expect(WASM_STAGES).toEqual([
            'probe', 'runtime', 'start', 'levels', 'tape', 'running', 'finished', 'verdict',
        ]);
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
        expect(VERDICT_SCOPE).toMatch(/per-tick differential/);
        expect(verdictLine(verdictOf(expected(), status(), 0))).toBe('wasm verdict: agrees');
    });

    it('the measured tolerance is ZERO, and it is the DEFAULT', () => {
        // §18.15: five committed tapes, both sides, max |Δx| = max |Δy| = 0.
        // A tolerance above what was measured is a bound nothing can reach.
        expect(END_STATE_TOLERANCE).toBe(0);
        expect(verdictOf(expected(), status({ x: 88.5 })).agrees).toBe(false);
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
