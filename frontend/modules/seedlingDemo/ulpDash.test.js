/**
 * ⛓⛓⛓ R9 SLICE 12e⁗ — **THE DIAGONAL SWORD DASH, TO THE LAST BIT.**
 *
 * `Player.as:783-791`'s dash arm is one line:
 *
 * ```as3
 *   knockback(2, new Point(x - v.x, y - v.y));
 * ```
 *
 * and `Player.as:1493-1513` is the other half:
 *
 * ```as3
 *   var center:Point = new Point(x - p.x, y - p.y);   // = x - (x - v.x)
 *   center.normalize(1);
 *   if (Math.abs(center.x) >= 0.5) v.x += f * center.x;
 *   if (Math.abs(center.y) >  0.5) v.y += f * center.y;
 * ```
 *
 * The model had **both** rounding sites wrong, and the third re-record run is
 * what found them: thirteen walks driven in the real game, all thirteen
 * recorded, and eight of the recordings the model could not reproduce — every
 * one by ~1 ULP, at one tick, on exactly the tapes carrying a `primary`
 * DOUBLE-PRESS released while both a horizontal and a vertical direction key
 * were held (kickoff §37.6). Those eight recordings are banked in
 * `fixtures/refuted/` and are the acceptance rows at the bottom of this file.
 *
 * ⚠ **NEITHER SOURCE IS SUFFICIENT ALONE**, which is the whole reason to
 * transcribe the expression instead of fixing the plausible-looking arithmetic
 * in it: measured over the thirteen, the round trip alone is 10/13, the
 * faithful `normalize(1)` alone is 5/13 — it fixes *nothing* — and together
 * they are 13/13. [[feedback_two_rulings_may_not_compose]]
 *
 * ⛔ NOTHING HERE HARDCODES A WITNESS. The 0.5-boundary velocity, the
 * round-trip witness and the divergence counts are all SEARCHED for from a
 * seeded stream, and each search asserts it found something — a row that went
 * vacuous would say so rather than pass.
 * [[feedback_fixture_must_discriminate_two_builds]]
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    applyFriction, knockbackImpulse, pointLength, pointNormalize,
} from './playerPhysicsV1.js';
import { fixtureNames } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import {
    diffObservationStreams, parseObservationStream, parseTape,
} from './tapeFormat.js';
import { runTapeToStream } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REFUTED = join(HERE, 'fixtures', 'refuted');

/** One reproducible stream, so every row below is a measurement anyone can re-run. */
const lcg = (seed) => {
    let s = seed >>> 0;
    return () => (s = ((s * 1664525) + 1013904223) >>> 0) / 4294967296;
};

/**
 * Velocities and positions with the mantissas the GAME's actually have.
 *
 * ⚠ THIS GENERATOR IS THE CARE IN THIS FILE, and the first one written was
 * wrong: sampling `x` and `v` straight out of the PRNG gives operands with
 * ~30 significant bits, `x - v.x` is then EXACT, and the round trip
 * measured 0 divergences in 200 000 samples — a fixture that would have
 * blessed the defect. Real velocities come out of `Point.normalize` (that is
 * what `Mobile.friction` is) and real positions are sums of them, so the
 * operands are full-width. Running the model's own `applyFriction` is what
 * makes the sample the game's kind of number rather than a tidy one.
 */
function* gameLikeStates(seed, { axis = false } = {}) {
    const r = lcg(seed);
    let x = 80;
    let y = 64;
    let v = { x: 0, y: 0 };
    for (;;) {
        v = applyFriction({
            x: v.x + ((r() * 2) - 1) * 0.5,
            y: axis ? 0 : v.y + ((r() * 2) - 1) * 0.5,
        }, 0.4);
        x += v.x;
        y += v.y;
        if (x < 0 || x > 512) x = 80;
        if (y < 0 || y > 512) y = 64;
        if (v.x === 0 && v.y === 0) continue;
        yield { x, y, v };
    }
}

/**
 * ⛔ THE REFUTED SPELLING, KEPT HERE AS A LOCAL so the split can be MEASURED
 * rather than asserted. This is `knockbackImpulse`'s body as it stood before
 * this slice — `Math.hypot` and `cx / length` — and nothing in the model calls
 * it. The rows below compare it against the transcription; without it the file
 * could only say what the model does now, not what the defect was.
 */
const refutedImpulse = (cx, cy, f) => {
    const length = Math.hypot(cx, cy);
    const nx = length === 0 ? 0 : cx / length;
    const ny = length === 0 ? 0 : cy / length;
    return {
        dvx: Math.abs(nx) >= 0.5 ? f * nx : 0,
        dvy: Math.abs(ny) > 0.5 ? f * ny : 0,
    };
};

/** The centre the AS3 builds: `x - (x - v.x)`, not `v.x`. */
const roundTrip = (x, y, v) => [x - (x - v.x), y - (y - v.y)];
const same = (a, b) => a.dvx === b.dvx && a.dvy === b.dvy;

const SAMPLES = 200000;
const FORCE = 2; // `knockback(2, …)` — `Player.as:788`.

describe('`Point.normalize` has ONE spelling in the model', () => {
    it('⛓ `knockbackImpulse` IS `pointNormalize` plus the game\'s two guards', () => {
        // A BEHAVIOURAL pin, not a grep: this can only hold for one spelling.
        // `Math.hypot` and `cx / length` disagree with `sqrt(x*x+y*y)` and
        // `x * (thickness/length)` often enough that a single sample would
        // usually catch them, and 200 000 cannot miss.
        let checked = 0;
        for (const { x, y, v } of gameLikeStates(3)) {
            const n = pointNormalize(v.x, v.y, 1);
            expect(knockbackImpulse(v.x, v.y, FORCE)).toEqual({
                dvx: Math.abs(n.x) >= 0.5 ? FORCE * n.x : 0,
                dvy: Math.abs(n.y) > 0.5 ? FORCE * n.y : 0,
            });
            if (++checked >= 20000) break;
        }
        expect(checked).toBe(20000);
    });

    it('⛔ and the SECOND spelling is gone from the source, not just unused', () => {
        // Comment lines are stripped first: the docblocks above deliberately
        // NAME `Math.hypot` as the thing that left, and a grep that could not
        // tell prose from code would forbid saying so.
        const code = readFileSync(join(HERE, 'playerPhysicsV1.js'), 'utf8')
            .split('\n')
            .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
            .join('\n');
        expect(code).not.toMatch(/Math\.hypot/);
        expect(code).toMatch(/pointNormalize\(cx, cy, 1\)/);
    });
});

describe('the two ULP sources, measured', () => {
    /** Walk one seeded stream and count what each pair of builds disagrees on. */
    const census = (axis) => {
        const out = { rounded: 0, refutedMoves: 0, gameMoves: 0, spellings: 0, witness: null };
        let seen = 0;
        for (const { x, y, v } of gameLikeStates(1, { axis })) {
            const [rx, ry] = roundTrip(x, y, v);
            if (rx !== v.x || ry !== v.y) out.rounded++;
            // The DEFECT's own question: under the refuted spelling, does
            // writing the round trip out change anything?
            if (!same(refutedImpulse(v.x, v.y, FORCE), refutedImpulse(rx, ry, FORCE))) {
                out.refutedMoves++;
            }
            // The same question under the game's spelling.
            if (!same(knockbackImpulse(v.x, v.y, FORCE), knockbackImpulse(rx, ry, FORCE))) {
                out.gameMoves++;
            }
            // And the OTHER source, on its own: the two spellings, same centre.
            const a = refutedImpulse(rx, ry, FORCE);
            const b = knockbackImpulse(rx, ry, FORCE);
            if (!same(a, b)) {
                out.spellings++;
                if (out.witness === null) out.witness = { x, y, v, refuted: a, game: b };
            }
            if (++seen >= SAMPLES) break;
        }
        return out;
    };

    it('⛓⛓ the SPLIT: under the REFUTED spelling an AXIS dash cannot round-trip', () => {
        const diagonal = census(false);
        const axis = census(true);
        // ⛓⛓⛓ THIS IS THE WHOLE REASON THE DEFECT HID FOR TWO RUNGS, and it is
        // a property of `Math.hypot`, not of the arithmetic: `hypot(x, 0)` is
        // exactly `|x|` by spec, so the refuted spelling normalised an axis
        // centre to EXACTLY (±1, 0) whatever the magnitude was — the position
        // round trip changed the magnitude and could not change the impulse.
        expect(axis.rounded).toBeGreaterThan(SAMPLES / 2);
        expect(axis.refutedMoves).toBe(0);
        // On a diagonal it bites, and that is exactly the tapes the game refused.
        expect(diagonal.refutedMoves).toBeGreaterThan(SAMPLES / 10);
        // ⛔ AND IT IS THE OLD BUILD'S PROPERTY, NOT A LAW ABOUT AXES: under
        // the game's own spelling the round trip moves an axis impulse too.
        // The committed roster is inert across this change by a two-build
        // stream diff over 149 tapes — a measurement about the CORPUS, and it
        // is stated as one rather than as a guarantee.
        expect(axis.gameMoves).toBeGreaterThan(0);
    });

    it('⛓⛓ the SECOND source is TWO differences, and only one is diagonal-only', () => {
        // §37.6 named both — `Math.hypot` AND `cx / length` — and they are not
        // the same shape. Measured, not asserted.
        const census = (axis) => {
            let lengths = 0;
            let divisions = 0;
            let seen = 0;
            for (const { v } of gameLikeStates(1, { axis })) {
                const L = pointLength(v.x, v.y);
                if (Math.hypot(v.x, v.y) !== L) lengths++;
                // `Point.normalize` MULTIPLIES BY A RECIPROCAL
                // (`avm2_globals.c:1085-1087` — `norm = thickness / length;
                // slots[1] = x * norm`). It does not divide.
                if (v.x / L !== v.x * (1 / L) || v.y / L !== v.y * (1 / L)) divisions++;
                if (++seen >= SAMPLES) break;
            }
            return { lengths, divisions };
        };
        const diagonal = census(false);
        const axis = census(true);

        // ⛓ The LENGTH difference is diagonal-only, and the zero is PROVABLE:
        // `hypot(x, 0)` is exactly `|x|` by spec, and `sqrt(fl(x*x))` recovers
        // `|x|` exactly in binary64 — so §37.6's `0 of 200 000` for axes
        // stands, and it is the LENGTH's zero, not the impulse's.
        expect(axis.lengths).toBe(0);
        expect(diagonal.lengths).toBeGreaterThan(SAMPLES / 10);
        let sqrtLoses = 0;
        const r = lcg(9);
        for (let i = 0; i < 200000; i++) {
            const x = ((r() * 512) - 256) * (1 + (r() * 1e-9));
            if (Math.sqrt(x * x) !== Math.abs(x)) sqrtLoses++;
        }
        expect(sqrtLoses).toBe(0);

        // ⛓ The DIVISION-ORDER difference is on BOTH — which is why the
        // corrected model moves axis arithmetic too, and why the roster's
        // inertness had to be MEASURED rather than argued.
        expect(axis.divisions).toBeGreaterThan(SAMPLES / 20);
        expect(diagonal.divisions).toBeGreaterThan(SAMPLES / 10);
    });

    it('⛓⛓ the SECOND source is real on its own — the two spellings diverge', () => {
        const diagonal = census(false);
        expect(diagonal.spellings).toBeGreaterThan(SAMPLES / 10);
        expect(diagonal.witness).not.toBeNull();
        // ⛓ AND THE DIVERGENCE IS EXACTLY THE SHAPE THE GAME REFUSED: a handful
        // of ULPs at the impulse's own magnitude, not a visible error. Every
        // failing recording was 7.105427357601002e-15 px or a small multiple.
        const { refuted, game } = diagonal.witness;
        const ulpsOf = (value) => Math.abs(value || 1) * Number.EPSILON;
        const dx = Math.abs(refuted.dvx - game.dvx);
        const dy = Math.abs(refuted.dvy - game.dvy);
        expect(dx + dy).toBeGreaterThan(0);
        expect(dx).toBeLessThanOrEqual(8 * ulpsOf(refuted.dvx));
        expect(dy).toBeLessThanOrEqual(8 * ulpsOf(refuted.dvy));
    });

    it('⛔ NEITHER SOURCE IS SUFFICIENT — that is why the expression is transcribed', () => {
        // §37.6's isolation, in one row: on some diagonal the refuted spelling
        // and the game's disagree EVEN AFTER the round trip is written out
        // (so E1 alone leaves reds), and the round trip changes the answer
        // EVEN UNDER the refuted spelling (so E2 alone leaves reds). The
        // thirteen recordings are the measurement; this is the arithmetic
        // saying the same thing. [[feedback_two_rulings_may_not_compose]]
        const d = census(false);
        expect(d.spellings).toBeGreaterThan(0);   // E1 is not enough
        expect(d.refutedMoves).toBeGreaterThan(0); // E2 is not enough
    });
});

describe('the two guards are the GAME\'s — `>=` on x and `>` on y', () => {
    /**
     * A velocity whose normalised component is EXACTLY 0.5 is the one input
     * the two comparisons disagree on: 60° to an axis. Searched for by
     * stepping the bit pattern of `sqrt(3)`, never typed.
     */
    const stepBits = (value, k) => {
        const buf = new DataView(new ArrayBuffer(8));
        buf.setFloat64(0, value);
        buf.setBigInt64(0, buf.getBigInt64(0) + BigInt(k));
        return buf.getFloat64(0);
    };
    const findBoundary = (build, read) => {
        for (let i = -20000; i <= 20000; i++) {
            const c = stepBits(Math.sqrt(3), i);
            if (read(pointNormalize(...build(c))) === 0.5) return c;
        }
        return null;
    };

    it('⛓ at exactly 0.5 the X axis TAKES the impulse and the Y axis DOES NOT', () => {
        const cyAt = findBoundary((c) => [1, c, 1], (n) => n.x);
        const cxAt = findBoundary((c) => [c, 1, 1], (n) => n.y);
        // The search must have found the boundary, or the row proves nothing.
        expect(cyAt).not.toBeNull();
        expect(cxAt).not.toBeNull();
        expect(pointNormalize(1, cyAt, 1).x).toBe(0.5);
        expect(pointNormalize(cxAt, 1, 1).y).toBe(0.5);

        // `Math.abs(center.x) >= 0.5` — TAKEN.
        expect(knockbackImpulse(1, cyAt, FORCE).dvx).toBe(FORCE * 0.5);
        // `Math.abs(center.y) >  0.5` — NOT taken. Regularising the pair
        // would be right on every axis-aligned and every 45° case and wrong
        // on the one input the source distinguishes.
        expect(knockbackImpulse(cxAt, 1, FORCE).dvy).toBe(0);
    });

    it('⛓ zero length is exactly inert — `point_normalize` skips, both guards reject', () => {
        expect(knockbackImpulse(0, 0, FORCE)).toEqual({ dvx: 0, dvy: 0 });
    });
});

/**
 * ⛓⛓⛓ THE ACCEPTANCE ROWS — the game's own word, replayed offline.
 *
 * Each of these is a stream the REAL GAME produced on the real Flash build
 * during the third re-record run, beside the tape that produced it. The model
 * must reproduce every tick of every one EXACTLY; `diffObservationStreams`
 * returns `null` or it names the first tick that differs.
 *
 * Under the model as it stood, all eight of these red — and the four builds
 * of §37.6's isolation table give 5, 10, 5 and 13 of thirteen. This file
 * carries the eight that DISCRIMINATE; the axis-dash control is the whole
 * committed roster, which is inert across the change by a two-build stream
 * diff over 149 tapes.
 */
const REFUSED = Object.freeze([
    'r8-d2', 'r8-d2-19', 'r8-d2-20', 'r8-solve-18',
    'r8-solve-20', 'r9-solve-0', 'r9-solve-13', 'r9-solve-14',
]);

describe('the eight recordings the game refused — RETIRED WITH THE SERIES', () => {
    /**
     * ⛓⛓⛓ R9 SLICE 12h — THE BANK IS SPENT, AND THE MEASUREMENT SAYS SO.
     *
     * These eight were banked because the recordings the game made were VALID
     * and the model was refuted, while the walks themselves were parked on a
     * branch. §38.8 said the run that landed the series would "either retire
     * the bank or re-point the rows at the roster", and that re-pointing is
     * the WEAKER choice — a pin reading a roster tape stops pinning the
     * moment a later licence moves that tape.
     *
     * The series landed here. **Measured before the files were removed: all
     * eight banked EXPECTATIONS were byte-identical to the roster's**, i.e.
     * the recordings the game refused ARE the roster's recordings now, and
     * the whole-roster replay asserts every tick of every one of them.
     * Keeping a second copy would have pinned nothing the roster does not.
     *
     * ⛔⛔ AND THE ROW THAT WAS SUPPOSED TO NOTICE WENT GREEN FOR THE WRONG
     * REASON. The retired guard asserted each banked tape DIFFERS from the
     * roster tape of the same name, and its own comment said *"the day that
     * stops being true is the day the fourth run lands the series"*. That day
     * came — and the row still PASSED, because ⚖ ruling 57's `sound` pin
     * landed in the same run and left the tapes differing by ONE FIELD that
     * has nothing to do with what the row was asserting. A guard that
     * survives on an unrelated difference is not a guard; it is a green row
     * whose subject has quietly left. Six of the eight differed by `pins`
     * alone, two by `pins`, `rng` and `tick0`.
     */
    it('⛔ the bank holds ONLY the R8 negative oracle, and the eight are gone', () => {
        const left = readdirSync(REFUTED).filter((f) => f.endsWith('.json')).sort();
        expect(left).toEqual(['r8-solve-5.expectation.json', 'r8-solve-5.tape.json']);
    });

    it('⛓ …and the eight are on the ROSTER, which is what replaces the bank', () => {
        // The claim the bank used to carry — "the model reproduces each of
        // these recordings tick for tick" — is now the roster's own, asserted
        // for all 149 tapes by `tapeRunner`'s rows. These eight are named
        // here so a roster that LOST one is still a red in this file.
        for (const name of REFUSED) expect(fixtureNames()).toContain(name);
    });
});
