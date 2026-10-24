/**
 * L60's KILL PAIR — the rung's first live kill, at stream level.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 3.
 *
 * `r5Acceptance.test.js` mutates the CLAIM; this file asserts the SHAPE of
 * the two committed recordings against each other. They answer different
 * questions: one is "would the check fire if the game had done something
 * else", the other is "what did the game actually do".
 *
 * ── WHAT THE PAIR TURNED OUT TO BE ────────────────────────────────────
 *
 * ⛓ The two streams are **byte-identical for 328 of their 359
 * observations** and part at exactly the lock's face. That is a stronger
 * statement than the authoring makes: the tapes differ by ten `primary`
 * spans, and ten sword presses turn out to move the player NOT AT ALL —
 * the 31-tick cadence clears `slashTimer` (20), so no press becomes a dash
 * and no `knockback(2, ...)` is ever applied. So the pair is one field
 * apart in EFFECT as well as in authoring, and the only difference in 359
 * observations is what the lock did.
 */

import { describe, expect, it } from 'vitest';

import { loadExpectation, loadTape } from './fixtures/index.js';
import { L60_CONTROL, L60_KILL, L60_LOCK } from './r5Acceptance.js';
import { KILL_PRESS_CADENCE, SLASH_TIMER_MAX } from './combatVerbs.js';

const kill = loadExpectation(L60_KILL).stream.ticks;
const control = loadExpectation(L60_CONTROL).stream.ticks;
const killTape = loadTape(L60_KILL);
const controlTape = loadTape(L60_CONTROL);

describe('the two tapes are ONE FIELD apart', () => {
    it('differ only in `inputs`', () => {
        const { inputs: a, ...restKill } = killTape;
        const { inputs: b, ...restControl } = controlTape;
        // `name` and `description` are the two fields that MUST differ, or
        // the pair could not be told apart in a report.
        expect({ ...restKill, name: null, description: null })
            .toEqual({ ...restControl, name: null, description: null });
        expect(a).not.toEqual(b);
    });

    it('and the extra spans are ten `primary` presses at the 31-tick cadence', () => {
        const presses = killTape.inputs.filter((s) => s.key === 'primary');
        expect(presses).toHaveLength(10);
        expect(controlTape.inputs.filter((s) => s.key === 'primary')).toHaveLength(0);
        for (let i = 1; i < presses.length; i += 1) {
            expect(presses[i].from - presses[i - 1].from).toBe(KILL_PRESS_CADENCE);
        }
        // ⚠ The cadence has to clear `slashTimer`, or every press after the
        // first is a DASH — `knockback(2, Point(x - v.x, y - v.y))`, an
        // impulse that MOVES the player and would make the two arms differ
        // during the fight for a reason that has nothing to do with the lock.
        expect(KILL_PRESS_CADENCE).toBeGreaterThan(SLASH_TIMER_MAX);
    });

    it('and the walk span is identical in both', () => {
        const w = (t) => t.inputs.filter((s) => s.key === 'right');
        expect(w(killTape)).toEqual(w(controlTape));
        expect(w(killTape)).toHaveLength(1);
    });
});

describe('what the game did', () => {
    it('both arms run the same length and never leave L60', () => {
        expect(kill).toHaveLength(359);
        expect(control).toHaveLength(359);
        expect(new Set(kill.map((o) => o.level))).toEqual(new Set([L60_LOCK.level]));
        expect(new Set(control.map((o) => o.level))).toEqual(new Set([L60_LOCK.level]));
    });

    it('⛓ and never leave ROW 5 — y is constant at 88 in both', () => {
        // The room is Pit everywhere but the one-tile corridor, and Pit is
        // NOT a coerced hazard on this tape. A y that moved would mean the
        // walk was falling, and the first authored version of this pair did
        // exactly that with an eight-pixel boot error.
        expect(new Set(kill.map((o) => o.y))).toEqual(new Set([88]));
        expect(new Set(control.map((o) => o.y))).toEqual(new Set([88]));
    });

    it('⛓ are IDENTICAL for 328 observations — ten sword presses move nobody', () => {
        for (let t = 0; t < 328; t += 1) {
            expect(kill[t], `observation ${t}`).toEqual(control[t]);
        }
        expect(kill[328]).not.toEqual(control[328]);
    });

    it('part at the LOCK FACE, not anywhere else', () => {
        // t=328 is 13 ticks into the shared 30-tick hold of RIGHT: the
        // control arm has run out of room and the kill arm walks into a
        // rect that is no longer `Solid`.
        //
        // ⚠ The box edge stops just SHORT of the face and never reaches it.
        // `Mobile.moveX` steps `min(1, |xrel| - i)` at a time and returns as
        // soon as the NEXT step would collide, so the residue is whatever is
        // left of the last fractional step — 127.9 here, creeping to 127.95
        // by the end. An assertion written as `x + 2 === 128` would be
        // asserting a sweep this game does not do.
        expect(control[328].x + 2).toBeLessThan(L60_LOCK.rect.x);
        expect(control[328].x + 2).toBeGreaterThan(L60_LOCK.rect.x - 1);
        expect(kill[328].x).toBeGreaterThan(control[328].x);
        expect(control[327].x).toBe(kill[327].x);
    });

    it('end pinned at 125.95 and crossed at 151.3', () => {
        expect(control.at(-1).x).toBeCloseTo(125.95, 5);
        expect(kill.at(-1).x).toBeCloseTo(151.3, 5);
        // The crossing is unambiguous in both directions: clear of the
        // lock's right face, and short of the east teleporter's trigger.
        expect(kill.at(-1).x - 2).toBeGreaterThanOrEqual(L60_LOCK.rect.right);
        expect(kill.at(-1).x + 2).toBeLessThan(160);
    });

    it('both come to REST before the tape ends (the §10.2 window contract)', () => {
        // The last x change is at t=351 in both, seven observations before
        // the end — so the release edge fires inside the tape and neither
        // arm would drift across a boundary if these became windows.
        const lastMove = (s) => {
            for (let i = s.length - 1; i > 0; i -= 1) if (s[i].x !== s[i - 1].x) return i;
            return 0;
        };
        expect(lastMove(kill)).toBe(351);
        expect(lastMove(control)).toBe(351);
        expect(kill.length - 1 - lastMove(kill)).toBeGreaterThanOrEqual(7);
    });
});
